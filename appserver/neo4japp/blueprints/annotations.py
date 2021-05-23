import csv
import hashlib
import html
import io
import json
import re
import time

import sqlalchemy as sa
from datetime import datetime
from typing import Optional, List, Dict, Any

from flask import (
    Blueprint,
    current_app,
    g,
    make_response,
    request,
    jsonify,
)
from flask_apispec import use_kwargs
from json import JSONDecodeError
from sqlalchemy import and_
from sqlalchemy.exc import SQLAlchemyError
from webargs.flaskparser import use_args
from marshmallow import validate, fields

from .filesystem import bp as filesystem_bp
from ..models.files import AnnotationChangeCause, FileAnnotationsVersion

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.filesystem import FilesystemBaseView
from neo4japp.blueprints.permissions import requires_role
from neo4japp.constants import LogEventType, TIMEZONE
from neo4japp.data_transfer_objects.common import ResultList
from neo4japp.database import (
    db,
    get_excel_export_service,
    get_manual_annotation_service,
    get_sorted_annotation_service,
    get_enrichment_table_service
)
from neo4japp.exceptions import AnnotationError
from neo4japp.models import (
    AppUser,
    Files,
    FileContent,
    GlobalList,
    FallbackOrganism
)
from neo4japp.services.annotations.constants import (
    DEFAULT_ANNOTATION_CONFIGS,
    EntityType,
    ManualAnnotationType,
)
from neo4japp.services.annotations.data_transfer_objects import (
    GlobalAnnotationData
)
from neo4japp.services.annotations.pipeline import (
    create_annotations_from_pdf,
    create_annotations_from_enrichment_table
)
from neo4japp.services.annotations import AnnotationGraphService
from neo4japp.services.annotations.sorted_annotation_service import (
    default_sorted_annotation,
    sorted_annotations_dict
)
from neo4japp.services.enrichment.data_transfer_objects import EnrichmentCellTextMapping
from neo4japp.schemas.annotations import (
    AnnotationConfigurations,
    AnnotationGenerationRequestSchema,
    MultipleAnnotationGenerationResponseSchema,
    GlobalAnnotationsDeleteSchema,
    CustomAnnotationCreateSchema,
    CustomAnnotationDeleteSchema,
    AnnotationUUIDListSchema,
    AnnotationExclusionCreateSchema,
    AnnotationExclusionDeleteSchema,
    SystemAnnotationListSchema,
    CustomAnnotationListSchema
)
from neo4japp.schemas.filesystem import BulkFileRequestSchema
from neo4japp.schemas.enrichment import EnrichmentTableSchema
from neo4japp.utils.logger import UserEventLog
from neo4japp.utils.http import make_cacheable_file_response


bp = Blueprint('annotations', __name__, url_prefix='/annotations')


class FileAnnotationsView(FilesystemBaseView):
    decorators = [auth.login_required]

    def get(self, hash_id: str):
        """Fetch annotations for a file.."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)

        if file.annotations:
            annotations = file.annotations['documents'][0]['passages'][0]['annotations']

            def terms_match(term_in_exclusion, term_in_annotation, is_case_insensitive):
                if is_case_insensitive:
                    return term_in_exclusion.lower() == term_in_annotation.lower()
                return term_in_exclusion == term_in_annotation

            # Add additional information for annotations that were excluded
            for annotation in annotations:
                for exclusion in file.excluded_annotations:
                    if (exclusion.get('type') == annotation['meta']['type'] and
                            terms_match(
                                exclusion.get('text', 'True'),
                                annotation.get('textInDocument', 'False'),
                                exclusion['isCaseInsensitive'])):
                        annotation['meta']['isExcluded'] = True
                        annotation['meta']['exclusionReason'] = exclusion['reason']
                        annotation['meta']['exclusionComment'] = exclusion['comment']
        else:
            annotations = []

        results = annotations + file.custom_annotations

        return jsonify(SystemAnnotationListSchema().dump({
            'results': results,
            'total': len(results),
        }))


class EnrichmentAnnotationsView(FilesystemBaseView):
    decorators = [auth.login_required]

    def get(self, hash_id: str):
        """Fetch annotations for enrichment table."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)

        if file.enrichment_annotations:
            annotations = file.enrichment_annotations
        else:
            annotations = None

        return jsonify({
            'results': EnrichmentTableSchema().dump(annotations)
        })


class FileCustomAnnotationsListView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(CustomAnnotationCreateSchema)
    def post(self, params, hash_id):
        current_user = g.current_user
        manual_annotation_service = get_manual_annotation_service()

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=True)

        results = manual_annotation_service.add_inclusions(
            file, current_user, params['annotation'], params['annotate_all']
        )

        return jsonify(CustomAnnotationListSchema().dump({
            'results': results,
            'total': len(results),
        }))


class FileCustomAnnotationsDetailView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(CustomAnnotationDeleteSchema)
    def delete(self, params, hash_id, uuid):
        current_user = g.current_user
        manual_annotation_service = get_manual_annotation_service()

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=True)

        results = manual_annotation_service.remove_inclusions(
            file, current_user, uuid, params['remove_all']
        )

        return jsonify(AnnotationUUIDListSchema().dump({
            'results': results,
            'total': len(results),
        }))


class FileAnnotationExclusionsListView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(AnnotationExclusionCreateSchema)
    def post(self, params, hash_id):
        current_user = g.current_user
        manual_annotation_service = get_manual_annotation_service()

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=True)

        manual_annotation_service.add_exclusion(file, current_user, params['exclusion'])

        return jsonify({})

    @use_args(AnnotationExclusionDeleteSchema)
    def delete(self, params, hash_id):
        current_user = g.current_user
        manual_annotation_service = get_manual_annotation_service()

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=True)

        manual_annotation_service.remove_exclusion(file, current_user, params['type'],
                                                   params['text'])

        return jsonify({})


class FileAnnotationCountsView(FilesystemBaseView):
    decorators = [auth.login_required]

    def get_rows(self, files):
        manual_annotations_service = get_manual_annotation_service()

        yield [
            'entity_id',
            'type',
            'text',
            'primary_name',
            'count',
        ]

        counts = {}

        for file in files:
            annotations = manual_annotations_service.get_file_annotations(file)
            for annotation in annotations:
                key = annotation['meta']['id']
                if key not in counts:
                    counts[key] = {
                        'annotation': annotation,
                        'count': 1
                    }
                else:
                    counts[key]['count'] += 1

        count_keys = sorted(
            counts,
            key=lambda key: counts[key]['count'],
            reverse=True
        )

        for key in count_keys:
            annotation = counts[key]['annotation']
            meta = annotation['meta']
            if annotation.get('keyword', None) is not None:
                text = annotation['keyword'].strip()
            else:
                text = annotation['meta']['allText'].strip()
            yield [
                meta['id'],
                meta['type'],
                text,
                annotation.get('primaryName', '').strip(),
                counts[key]['count']
            ]

    def post(self, hash_id: str):
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)
        files = self.get_nondeleted_recycled_children(
            Files.id == file.id,
            children_filter=Files.mime_type == 'application/pdf',
            lazy_load_content=True
        )

        buffer = io.StringIO()
        writer = csv.writer(buffer, delimiter="\t", quotechar='"')
        for row in self.get_rows(files):
            writer.writerow(row)

        result = buffer.getvalue().encode('utf-8')

        return make_cacheable_file_response(
            request,
            result,
            etag=hashlib.sha256(result).hexdigest(),
            filename=f'{file.filename} - Annotations.tsv',
            mime_type='text/tsv'
        )


class FileAnnotationSortedView(FilesystemBaseView):
    decorators = [auth.login_required]

    def get_rows(self, files, annotation_service):
        values = annotation_service.get_annotations(files)

        yield [
            'entity_id',
            'type',
            'text',
            'primary_name',
            'value',
        ]

        value_keys = sorted(
                values,
                key=lambda key: values[key]['value'],
                reverse=True
        )

        for key in value_keys:
            annotation = values[key]['annotation']
            meta = annotation['meta']
            if annotation.get('keyword', None) is not None:
                text = annotation['keyword'].strip()
            else:
                text = annotation['meta']['allText'].strip()
            yield [
                meta['id'],
                meta['type'],
                text,
                annotation.get('primaryName', '').strip(),
                values[key]['value']
            ]

    @use_args({
        "sort": fields.Str(
                missing=default_sorted_annotation.id,
                validate=validate.OneOf(sorted_annotations_dict)
        ),
        "hash_id": fields.Str()
    })
    def post(self, args: Dict[str, str], hash_id: str):
        sort = args['sort']
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)

        buffer = io.StringIO()
        writer = csv.writer(buffer, delimiter="\t", quotechar='"')

        if file.mime_type == 'vnd.***ARANGO_DB_NAME***.document/enrichment-table':
            files = self.get_nondeleted_recycled_files(
                    Files.id == file.id,
                    lazy_load_content=True
            )

            annotation_service = get_sorted_annotation_service(sort, mime_type=file.mime_type)
            for row in self.get_rows(files, annotation_service):
                writer.writerow(row)
        else:
            files = self.get_nondeleted_recycled_children(
                    Files.id == file.id,
                    children_filter=and_(
                            Files.mime_type == 'application/pdf',
                            Files.recycling_date.is_(None)
                    ),
                    lazy_load_content=True
            )

            annotation_service = get_sorted_annotation_service(sort)
            for row in self.get_rows(files, annotation_service):
                writer.writerow(row)

        result = buffer.getvalue().encode('utf-8')

        return make_cacheable_file_response(
                request,
                result,
                etag=hashlib.sha256(result).hexdigest(),
                filename=f'{file.filename} - {sort} - Annotations.tsv',
                mime_type='text/tsv'
        )


class FileAnnotationGeneCountsView(FileAnnotationCountsView):
    def get_rows(self, files: List[Files]):
        manual_annotations_service = get_manual_annotation_service()
        annotation_graph_service = AnnotationGraphService()

        yield [
            'gene_id',
            'gene_name',
            'organism_id',
            'organism_name',
            'gene_annotation_count'
        ]

        gene_ids: Dict[Any, int] = {}

        for file in files:
            combined_annotations = manual_annotations_service.get_file_annotations(file)
            for annotation in combined_annotations:
                if annotation['meta']['type'] == EntityType.GENE.value:
                    gene_id = annotation['meta']['id']
                    if gene_ids.get(gene_id, None) is not None:
                        gene_ids[gene_id] += 1
                    else:
                        gene_ids[gene_id] = 1

        gene_organism_pairs = annotation_graph_service.get_organisms_from_gene_ids(
            gene_ids=list(gene_ids.keys())
        )
        sorted_pairs = sorted(gene_organism_pairs, key=lambda pair: gene_ids[pair['gene_id']],
                              reverse=True)  # noqa

        for pair in sorted_pairs:
            yield [
                pair['gene_id'],
                pair['gene_name'],
                pair['taxonomy_id'],
                pair['species_name'],
                gene_ids[pair['gene_id']],
            ]


class FileAnnotationsGenerationView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(lambda request: BulkFileRequestSchema())
    @use_args(lambda request: AnnotationGenerationRequestSchema())
    def post(self, targets, params):
        """Generate annotations for one or more files."""
        current_user = g.current_user

        files = self.get_nondeleted_recycled_files(Files.hash_id.in_(targets['hash_ids']),
                                                   lazy_load_content=True)
        self.check_file_permissions(files, current_user, ['writable'], permit_recycled=False)

        override_organism = None
        override_annotation_configs = None

        if params.get('organism'):
            override_organism = params['organism']
            db.session.add(override_organism)
            db.session.flush()

        if params.get('annotation_configs'):
            override_annotation_configs = params['annotation_configs']

        updated_files = []
        versions = []
        results = {}
        missing = self.get_missing_hash_ids(targets['hash_ids'], files)

        for file in files:
            if override_organism is not None:
                effective_organism = override_organism
            else:
                effective_organism = file.fallback_organism

            if override_annotation_configs is not None:
                effective_annotation_configs = override_annotation_configs
            elif file.annotation_configs is not None:
                effective_annotation_configs = file.annotation_configs
            else:
                effective_annotation_configs = DEFAULT_ANNOTATION_CONFIGS

            if file.mime_type == 'application/pdf':
                try:
                    annotations, version = self._annotate(
                        file=file,
                        cause=AnnotationChangeCause.SYSTEM_REANNOTATION,
                        configs=effective_annotation_configs,
                        organism=effective_organism,
                        user_id=current_user.id,
                    )
                except AnnotationError as e:
                    current_app.logger.error(
                        'Could not annotate file: %s, %s, %s', file.hash_id, file.filename, e)
                    results[file.hash_id] = {
                        'attempted': True,
                        'success': False,
                        'error': e.message
                    }
                else:
                    current_app.logger.debug(
                        'File successfully annotated: %s, %s', file.hash_id, file.filename)
                    updated_files.append(annotations)
                    versions.append(version)
                    results[file.hash_id] = {
                        'attempted': True,
                        'success': True,
                        'error': ''
                    }
            elif file.mime_type == 'vnd.***ARANGO_DB_NAME***.document/enrichment-table':
                try:
                    enrichment = json.loads(file.content.raw_file_utf8)
                except JSONDecodeError:
                    current_app.logger.error(
                        f'Cannot annotate file with invalid content: {file.hash_id}, {file.filename}')  # noqa
                    results[file.hash_id] = {
                        'attempted': False,
                        'success': False,
                        'error': 'Enrichment table content is not valid JSON.'
                    }
                    continue
                enrich_service = get_enrichment_table_service()

                try:
                    enriched = enrich_service.create_annotation_mappings(enrichment)

                    annotations, version = self._annotate_enrichment_texts(
                        file=file,
                        enriched=enriched,
                        cause=AnnotationChangeCause.SYSTEM_REANNOTATION,
                        configs=effective_annotation_configs,
                        organism=effective_organism,
                        user_id=current_user.id,
                        enrichment=enrichment
                    )
                except AnnotationError as e:
                    current_app.logger.error(
                        'Could not annotate file: %s, %s, %s', file.hash_id, file.filename, e)  # noqa
                    results[file.hash_id] = {
                        'attempted': True,
                        'success': False,
                        'error': e.message
                    }
                else:
                    current_app.logger.debug(
                        'File successfully annotated: %s, %s', file.hash_id, file.filename)
                    updated_files.append(annotations)
                    versions.append(version)
                    results[file.hash_id] = {
                        'attempted': True,
                        'success': True,
                        'error': ''
                    }
            else:
                results[file.hash_id] = {
                    'attempted': False,
                    'success': False,
                    'error': 'Invalid file type, can only annotate PDFs or Enrichment tables.'
                }

        db.session.bulk_insert_mappings(FileAnnotationsVersion, versions)
        db.session.bulk_update_mappings(Files, updated_files)
        db.session.commit()

        return jsonify(MultipleAnnotationGenerationResponseSchema().dump({
            'mapping': results,
            'missing': missing,
        }))

    def _annotate(
        self,
        file: Files,
        cause: AnnotationChangeCause,
        configs: AnnotationConfigurations,
        organism: Optional[FallbackOrganism] = None,
        user_id: int = None
    ):
        """Annotate PDF files."""
        annotations_json = create_annotations_from_pdf(
            annotation_configs=configs,
            specified_organism_synonym=organism.organism_synonym if organism else '',  # noqa
            specified_organism_tax_id=organism.organism_taxonomy_id if organism else '',  # noqa
            document=file,
            filename=file.filename
        )

        update = {
            'id': file.id,
            'annotations': annotations_json,
            'annotations_date': datetime.now(TIMEZONE),
        }

        if organism:
            update['fallback_organism'] = organism
            update['fallback_organism_id'] = organism.id

        version = {
            'file_id': file.id,
            'cause': cause,
            'custom_annotations': file.custom_annotations,
            'excluded_annotations': file.excluded_annotations,
            'user_id': user_id,
        }

        return update, version

    def _annotate_enrichment_texts(
        self,
        file: Files,
        enriched: EnrichmentCellTextMapping,
        cause: AnnotationChangeCause,
        user_id: int,
        enrichment: dict,
        organism: Optional[FallbackOrganism] = None,
        configs: AnnotationConfigurations = None
    ):
        """Annotate all text in enrichment table."""

        annotations_json = create_annotations_from_enrichment_table(
            annotation_configs=configs,
            specified_organism_synonym=organism.organism_synonym if organism else '',  # noqa
            specified_organism_tax_id=organism.organism_taxonomy_id if organism else '',  # noqa
            text=enriched.text,
            enrichment_mappings=enriched.text_index_map
        )

        annotations_list = annotations_json['documents'][0]['passages'][0]['annotations']
        # sort by lo_location_offset to go from beginning to end
        sorted_annotations_list = sorted(annotations_list, key=lambda x: x['loLocationOffset'])

        prev_index = -1
        enriched_gene = ''

        start = time.time()
        for index, cell_text in enriched.text_index_map:
            annotation_chunk = [anno for anno in sorted_annotations_list if anno.get(
                'hiLocationOffset', None) and anno.get('hiLocationOffset') <= index]
            # it's sorted so we can do this to make the list shorter every iteration
            sorted_annotations_list = sorted_annotations_list[len(annotation_chunk):]

            # update JSON to have enrichment row and domain...
            for anno in annotation_chunk:
                if prev_index != -1:
                    # only do this for subsequent cells b/c
                    # first cell will always have the correct index
                    # update index offset to be relative to the cell again
                    # since they're relative to the combined text
                    anno['loLocationOffset'] = anno['loLocationOffset'] - (prev_index + 1) - 1  # noqa
                    anno['hiLocationOffset'] = anno['loLocationOffset'] + anno['keywordLength'] - 1  # noqa

                if 'domain' in cell_text:
                    # imported should come first for each row
                    if cell_text['domain'] == 'Imported':
                        enriched_gene = cell_text['text']
                    anno['enrichmentGene'] = enriched_gene
                    if cell_text['domain'] == 'Regulon':
                        anno['enrichmentDomain']['domain'] = cell_text['domain']
                        anno['enrichmentDomain']['subDomain'] = cell_text['label']
                    else:
                        anno['enrichmentDomain']['domain'] = cell_text['domain']

            snippet = self._highlight_annotations(
                original_text=cell_text['text'],
                annotations=annotation_chunk
            )
            if cell_text['domain'] == 'Imported':
                enrichment['result']['genes'][cell_text[
                    'index']]['annotatedImported'] = snippet
            elif cell_text['domain'] == 'Matched':
                enrichment['result']['genes'][cell_text[
                    'index']]['annotatedMatched'] = snippet
            elif cell_text['domain'] == 'Full Name':
                enrichment['result']['genes'][cell_text[
                    'index']]['annotatedFullName'] = snippet
            else:
                enrichment['result'][
                    'genes'][cell_text[
                        'index']]['domains'][cell_text[
                            'domain']][cell_text[
                                'label']]['annotatedText'] = snippet

            prev_index = index

        current_app.logger.info(
            f'Time to create enrichment snippets {time.time() - start}')

        update = {
            'id': file.id,
            'annotations': annotations_json,
            'annotations_date': datetime.now(TIMEZONE),
            'enrichment_annotations': enrichment
        }

        if organism:
            update['fallback_organism'] = organism
            update['fallback_organism_id'] = organism.id

        version = {
            'file_id': file.id,
            'cause': cause,
            'custom_annotations': file.custom_annotations,
            'excluded_annotations': file.excluded_annotations,
            'user_id': user_id,
        }

        return update, version

    def _highlight_annotations(self, original_text: str, annotations: List[dict]):
        # If done right, we would parse the XML but the built-in XML libraries in Python
        # are susceptible to some security vulns, but because this is an internal API,
        # we can accept that it can be janky

        texts = []
        prev_ending_index = -1

        for annotation in annotations:
            meta = annotation['meta']
            meta_type = annotation['meta']['type']
            term = annotation['textInDocument']
            lo_location_offset = annotation['loLocationOffset']
            hi_location_offset = annotation['hiLocationOffset']

            text = f'<annotation type="{meta_type}" meta="{html.escape(json.dumps(meta))}">{term}</annotation>'  # noqa

            if lo_location_offset == 0:
                prev_ending_index = hi_location_offset
                texts.append(text)
            else:
                if not texts:
                    texts.append(original_text[:lo_location_offset])
                    prev_ending_index = hi_location_offset
                    texts.append(text)
                else:
                    # TODO: would lo_location_offset == prev_ending_index ever happen?
                    # if yes, need to handle it
                    texts.append(original_text[prev_ending_index + 1:lo_location_offset])
                    prev_ending_index = hi_location_offset
                    texts.append(text)

        texts.append(original_text[prev_ending_index + 1:])
        final_text = ''.join(texts)
        return f'<snippet>{final_text}</snippet>'


class RefreshEnrichmentAnnotationsView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(lambda request: BulkFileRequestSchema())
    def post(self, targets):
        """Clear out the annotations."""
        current_user = g.current_user

        files = self.get_nondeleted_recycled_files(Files.hash_id.in_(targets['hash_ids']),
                                                   lazy_load_content=True)
        self.check_file_permissions(files, current_user, ['writable'], permit_recycled=False)

        updated_files = []
        for file in files:
            update = {
                'id': file.id,
                'annotations': [],
                'annotations_date': None,
                'enrichment_annotations': None
            }
            updated_files.append(update)
        db.session.bulk_update_mappings(Files, updated_files)
        db.session.commit()
        return jsonify({'results': 'Success'})


@bp.route('/global-list/inclusions')
@auth.login_required
@requires_role('admin')
def export_global_inclusions():
    yield g.current_user

    inclusions = GlobalList.query.filter_by(
        type=ManualAnnotationType.INCLUSION.value,
        reviewed=False
    ).all()

    def get_inclusion_for_review(inclusion):
        user = AppUser.query.filter_by(id=inclusion.annotation['user_id']).one_or_none()
        username = f'{user.first_name} {user.last_name}' if user is not None else 'not found'

        missing_data = any([
            inclusion.annotation['meta'].get('id', None) is None,
            inclusion.annotation['meta'].get('idHyperlink', None) is None
        ])

        if missing_data:
            current_app.logger.warning(
                f'Found inclusion in the global list with missing data:\n{inclusion.to_dict()}'
            )

        return {
            'id': inclusion.annotation['meta'].get('id', ''),
            'term': inclusion.annotation['meta']['allText'],
            'type': inclusion.annotation['meta']['type'],
            'hyperlink': inclusion.annotation['meta'].get('idHyperlink', ''),
            'inclusion_date': inclusion.annotation.get('inclusion_date', ''),
            'user': username,
        }

    data = [get_inclusion_for_review(inclusion) for inclusion in inclusions]

    exporter = get_excel_export_service()
    response = make_response(exporter.get_bytes(data), 200)
    response.headers['Content-Type'] = exporter.mimetype
    response.headers['Content-Disposition'] = \
        f'attachment; filename={exporter.get_filename("global_inclusions")}'
    yield response


@bp.route('/global-list/exclusions')
@auth.login_required
@requires_role('admin')
def export_global_exclusions():
    yield g.current_user

    exclusions = GlobalList.query.filter_by(
        type=ManualAnnotationType.EXCLUSION.value,
        reviewed=False,
    ).all()

    def get_exclusion_for_review(exclusion):
        user = AppUser.query.filter_by(id=exclusion.annotation['user_id']).one_or_none()
        username = f'{user.first_name} {user.last_name}' if user is not None else 'not found'

        missing_data = any([
            exclusion.annotation.get('text', None) is None,
            exclusion.annotation.get('type', None) is None,
            exclusion.annotation.get('idHyperlink', None) is None
        ])

        if missing_data:
            current_app.logger.warning(
                f'Found exclusion in the global list with missing data:\n{exclusion.to_dict()}'
            )

        return {
            'term': exclusion.annotation.get('text', ''),
            'type': exclusion.annotation.get('type', ''),
            'id_hyperlink': exclusion.annotation.get('idHyperlink', ''),
            'reason': exclusion.annotation['reason'],
            'comment': exclusion.annotation['comment'],
            'exclusion_date': exclusion.annotation['exclusion_date'],
            'user': username,
        }

    data = [get_exclusion_for_review(exclusion) for exclusion in exclusions]

    exporter = get_excel_export_service()
    response = make_response(exporter.get_bytes(data), 200)
    response.headers['Content-Type'] = exporter.mimetype
    response.headers['Content-Disposition'] = \
        f'attachment; filename={exporter.get_filename("global_exclusions")}'
    yield response


@bp.route('/global-list', methods=['GET'])
@auth.login_required
@requires_role('admin')
def get_annotation_global_list():

    yield g.current_user

    # Exclusions
    query_1 = db.session.query(
        FileContent.id,
        sa.sql.null().label('filename'),  # TODO: Subquery to get all linked files or download link?
        AppUser.email,
        GlobalList.id,
        GlobalList.type,
        GlobalList.reviewed,
        GlobalList.approved,
        GlobalList.creation_date,
        GlobalList.modified_date,
        GlobalList.annotation['text'].astext.label('text'),
        GlobalList.annotation['reason'].astext.label('reason'),
        GlobalList.annotation['type'].astext.label('entityType'),
        GlobalList.annotation['id'].astext.label('annotationId'),
        GlobalList.annotation['comment'].astext.label('comment')
    ).outerjoin(
        AppUser,
        AppUser.id == GlobalList.annotation['user_id'].as_integer()
    ).outerjoin(
        FileContent,
        FileContent.id == GlobalList.file_id
    ).filter(
        GlobalList.type == ManualAnnotationType.EXCLUSION.value
    )
    # Inclusions
    query_2 = db.session.query(
        FileContent.id,
        sa.sql.null().label('filename'),  # TODO: Subquery to get all linked files or download link?
        AppUser.email,
        GlobalList.id,
        GlobalList.type,
        GlobalList.reviewed,
        GlobalList.approved,
        GlobalList.creation_date,
        GlobalList.modified_date,
        GlobalList.annotation['meta']['allText'].astext.label('text'),
        sa.sql.null().label('reason'),
        GlobalList.annotation['meta']['type'].astext.label('entityType'),
        GlobalList.annotation['meta']['id'].astext.label('annotationId'),
        sa.sql.null().label('comment')
    ).outerjoin(
        AppUser,
        AppUser.id == GlobalList.annotation['user_id'].as_integer()
    ).outerjoin(
        FileContent,
        FileContent.id == GlobalList.file_id
    ).filter(GlobalList.type == ManualAnnotationType.INCLUSION.value)

    union_query = query_1.union(query_2)

    # TODO: Refactor to work with paginate_from_args
    limit = request.args.get('limit', 200)
    limit = min(200, int(limit))
    page = request.args.get('page', 1)
    page = max(1, int(page))

    # The order by clause is using a synthetic column
    # NOTE: We want to keep this ordering case insensitive
    query = union_query.order_by((sa.asc('text'))).paginate(page, limit, False)

    response = ResultList(
        total=query.total,
        results=[GlobalAnnotationData(
            file_id=r[0],
            filename=r[1],
            user_email=r[2],
            id=r[3],
            type=r[4],
            reviewed=r[5],
            approved=r[6],
            creation_date=r[7],
            modified_date=r[8],
            text=r[9],
            reason=r[10],
            entity_type=r[11],
            annotation_id=r[12],
            comment=r[13],
        ) for r in query.items],
        query=None)

    yield jsonify(response.to_dict())


@bp.route('/global-list', methods=['POST', 'DELETE'])
@auth.login_required
@use_kwargs(GlobalAnnotationsDeleteSchema)
@requires_role('admin')
def delete_global_annotations(pids):
    yield g.current_user

    query = GlobalList.__table__.delete().where(
        GlobalList.id.in_(pids)
    )
    try:
        db.session.execute(query)
    except SQLAlchemyError:
        db.session.rollback()
    else:
        db.session.commit()
        current_app.logger.info(
            f'Deleted {len(pids)} global annotations',
            extra=UserEventLog(
                username=g.current_user.username,
                event_type=LogEventType.ANNOTATION.value).to_dict()
        )
    yield jsonify(dict(result='success'))


@bp.route('/files/<int:file_id>', methods=['GET'])
def get_pdf_to_annotate(file_id):
    """This endpoint is sent by the annotation pipeline to the
    pdfparse service, and acts as a resource pull.
    """

    doc = Files.query.get(file_id)

    if not doc:
        raise AnnotationError(
            title='Failed to Annotate',
            message=f'File with file id {file_id} not found.',
            code=404)

    res = make_response(doc.content.raw_file)
    res.headers['Content-Type'] = 'application/pdf'
    res.headers['Content-Disposition'] = f'attachment;filename={doc.filename}.pdf'
    return res


filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations',
    view_func=FileAnnotationsView.as_view('file_annotations_list'))
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/enrichment/annotations',
    view_func=EnrichmentAnnotationsView.as_view('enrichment_file_annotations_list'))
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/custom',
    view_func=FileCustomAnnotationsListView.as_view('file_custom_annotations_list'))
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/custom/<string:uuid>',
    view_func=FileCustomAnnotationsDetailView.as_view('file_custom_annotations_detail'))
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/exclusions',
    view_func=FileAnnotationExclusionsListView.as_view('file_annotation_exclusions_list'))
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/counts',
    view_func=FileAnnotationCountsView.as_view('file_annotation_counts'))
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/sorted',
    view_func=FileAnnotationSortedView.as_view('file_annotation_sorted'))
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/gene-counts',
    view_func=FileAnnotationGeneCountsView.as_view('file_annotation_gene_counts'))
filesystem_bp.add_url_rule(
    'annotations/generate',
    view_func=FileAnnotationsGenerationView.as_view('file_annotation_generation'))
filesystem_bp.add_url_rule(
    'annotations/refresh',
    # TODO: this can potentially become a generic annotations refresh
    view_func=RefreshEnrichmentAnnotationsView.as_view('refresh_annotations'))
