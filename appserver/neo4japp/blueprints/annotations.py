import csv
import hashlib
import io
import json
import time

import sqlalchemy as sa

from datetime import datetime
from flask import (
    Blueprint,
    current_app,
    g,
    make_response,
    request,
    jsonify,
)
from flask.views import MethodView
from http import HTTPStatus
from json import JSONDecodeError
from marshmallow import validate, fields
from sqlalchemy import and_
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Dict, Any
from webargs.flaskparser import use_args

from neo4japp.exceptions import wrap_exceptions
from .auth import login_exempt
from .filesystem import bp as filesystem_bp, FilesystemBaseView
from .permissions import requires_role

from ..constants import LogEventType
from ..database import (
    db,
    get_excel_export_service,
    get_enrichment_table_service,
    get_or_create_arango_client,
)
from neo4japp.exceptions import AnnotationError, ServerException
from ..models import (
    AppUser,
    Files,
    GlobalList,
)
from ..models.files_queries import get_nondeleted_recycled_children_query
from ..schemas.annotations import (
    AnnotationGenerationRequestSchema,
    GlobalAnnotationTableType,
    MultipleAnnotationGenerationResponseSchema,
    GlobalAnnotationsDeleteSchema,
    GlobalAnnotationListSchema,
    CustomAnnotationCreateSchema,
    CustomAnnotationDeleteSchema,
    AnnotationUUIDListSchema,
    AnnotationExclusionCreateSchema,
    AnnotationExclusionDeleteSchema,
    SystemAnnotationListSchema,
    CustomAnnotationListSchema,
)
from ..schemas.common import PaginatedRequestSchema
from ..schemas.enrichment import EnrichmentTableSchema
from ..schemas.filesystem import BulkFileRequestSchema
from ..services.annotations.annotation_graph_service import get_organisms_from_gene_ids
from ..services.annotations.annotator_interface import (
    send_pdf_annotation_request,
    send_et_annotation_request,
)
from ..services.annotations.globals_service import get_global_exclusion_annotations
from ..services.annotations.constants import (
    EntityType,
    ManualAnnotationType,
)
from ..services.annotations.initializer import (
    get_manual_annotation_service,
    get_sorted_annotation_service,
)
from ..services.annotations.sorted_annotation_service import (
    default_sorted_annotation,
    sorted_annotations_dict,
)
from ..services.annotations.utils.graph_queries import (
    get_global_inclusions_paginated_query,
    get_global_inclusions_query,
    get_global_inclusions_count_query,
)
from ..services.arangodb import convert_datetime, execute_arango_query, get_db
from ..utils.logger import UserEventLog
from ..utils.http import make_cacheable_file_response
from ..utils.string import sub_whitespace

bp = Blueprint('annotations', __name__, url_prefix='/annotations')


class FileAnnotationsView(FilesystemBaseView):
    def get(self, hash_id: str):
        """Fetch annotations for a file.."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        self.check_file_permissions(
            [file], current_user, ['readable'], permit_recycled=True
        )

        if file.annotations:
            annotations = file.annotations['documents'][0]['passages'][0]['annotations']

            def terms_match(term_in_exclusion, term_in_annotation, is_case_insensitive):
                if is_case_insensitive:
                    return term_in_exclusion.lower() == term_in_annotation.lower()
                return term_in_exclusion == term_in_annotation

            # Add additional information for annotations that were excluded
            for annotation in annotations:
                for exclusion in file.excluded_annotations:
                    if exclusion.get('type') == annotation['meta'][
                        'type'
                    ] and terms_match(
                        exclusion.get('text', 'True'),
                        annotation.get('textInDocument', 'False'),
                        exclusion['isCaseInsensitive'],
                    ):
                        annotation['meta']['isExcluded'] = True
                        annotation['meta']['exclusionReason'] = exclusion['reason']
                        annotation['meta']['exclusionComment'] = exclusion['comment']
        else:
            annotations = []

        results = annotations + file.custom_annotations

        return jsonify(
            SystemAnnotationListSchema().dump(
                {
                    'results': results,
                    'total': len(results),
                }
            )
        )


class EnrichmentAnnotationsView(FilesystemBaseView):
    def get(self, hash_id: str):
        """Fetch annotations for enrichment table."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        self.check_file_permissions(
            [file], current_user, ['readable'], permit_recycled=True
        )

        if file.enrichment_annotations:
            annotations = file.enrichment_annotations
        else:
            annotations = None

        return jsonify({'results': EnrichmentTableSchema().dump(annotations)})


class FileCustomAnnotationsListView(FilesystemBaseView):
    @use_args(CustomAnnotationCreateSchema)
    def post(self, params, hash_id):
        current_user = g.current_user
        manual_annotation_service = get_manual_annotation_service()

        file = self.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        self.check_file_permissions(
            [file], current_user, ['writable'], permit_recycled=True
        )

        results = manual_annotation_service.add_inclusions(
            file, current_user, params['annotation'], params['annotate_all']
        )

        return jsonify(
            CustomAnnotationListSchema().dump(
                {
                    'results': results,
                    'total': len(results),
                }
            )
        )


class FileCustomAnnotationsDetailView(FilesystemBaseView):
    @use_args(CustomAnnotationDeleteSchema)
    def delete(self, params, hash_id, uuid):
        current_user = g.current_user
        manual_annotation_service = get_manual_annotation_service()

        file = self.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        self.check_file_permissions(
            [file], current_user, ['writable'], permit_recycled=True
        )

        results = manual_annotation_service.remove_inclusions(
            file, current_user, uuid, params['remove_all']
        )

        return jsonify(
            AnnotationUUIDListSchema().dump(
                {
                    'results': results,
                    'total': len(results),
                }
            )
        )


class FileAnnotationExclusionsListView(FilesystemBaseView):
    @use_args(AnnotationExclusionCreateSchema)
    def post(self, params, hash_id):
        current_user = g.current_user
        manual_annotation_service = get_manual_annotation_service()

        file = self.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        self.check_file_permissions(
            [file], current_user, ['writable'], permit_recycled=True
        )

        manual_annotation_service.add_exclusion(file, current_user, params['exclusion'])

        return jsonify({})

    @use_args(AnnotationExclusionDeleteSchema)
    def delete(self, params, hash_id):
        current_user = g.current_user
        manual_annotation_service = get_manual_annotation_service()

        file = self.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        self.check_file_permissions(
            [file], current_user, ['writable'], permit_recycled=True
        )

        manual_annotation_service.remove_exclusion(
            file, current_user, params['type'], params['text']
        )

        return jsonify({})


class FileAnnotationCountsView(FilesystemBaseView):
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
                    counts[key] = {'annotation': annotation, 'count': 1}
                else:
                    counts[key]['count'] += 1

        count_keys = sorted(counts, key=lambda key: counts[key]['count'], reverse=True)

        for key in count_keys:
            annotation = counts[key]['annotation']
            meta = annotation['meta']
            if annotation.get('keyword', None) is not None:
                text = annotation['keyword'].strip()
            else:
                text = annotation['meta']['allText'].strip()
            yield [
                sub_whitespace(meta['id']),
                meta['type'],
                sub_whitespace(text),
                sub_whitespace(annotation.get('primaryName', '').strip()),
                counts[key]['count'],
            ]

    def post(self, hash_id: str):
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        self.check_file_permissions(
            [file], current_user, ['readable'], permit_recycled=True
        )
        files = get_nondeleted_recycled_children_query(
            Files.id == file.id,
            children_filter=Files.mime_type == 'application/pdf',
            lazy_load_content=True,
        ).all()

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
            mime_type='text/tsv',
        )


class FileAnnotationSortedView(FilesystemBaseView):
    def get_rows(self, files, annotation_service):
        values = annotation_service.get_annotations(files)

        yield [
            'entity_id',
            'type',
            'text',
            'primary_name',
            'value',
        ]

        value_keys = sorted(values, key=lambda key: values[key]['value'], reverse=True)

        for key in value_keys:
            annotation = values[key]['annotation']
            meta = annotation['meta']
            if annotation.get('keyword', None) is not None:
                text = annotation['keyword'].strip()
            else:
                text = annotation['meta']['allText'].strip()
            yield [
                sub_whitespace(meta['id']),
                meta['type'],
                sub_whitespace(text),
                sub_whitespace(annotation.get('primaryName', '').strip()),
                values[key]['value'],
            ]

    @use_args(
        {
            "sort": fields.Str(
                missing=default_sorted_annotation.id,
                validate=validate.OneOf(sorted_annotations_dict),
            ),
            "hash_id": fields.Str(),
        }
    )
    def post(self, args: Dict[str, str], hash_id: str):
        sort = args['sort']
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        self.check_file_permissions(
            [file], current_user, ['readable'], permit_recycled=True
        )

        buffer = io.StringIO()
        writer = csv.writer(buffer, delimiter="\t", quotechar='"')

        if file.mime_type == 'vnd.***ARANGO_DB_NAME***.document/enrichment-table':
            files = self.get_nondeleted_recycled_files(
                Files.id == file.id, lazy_load_content=True
            )

            annotation_service = get_sorted_annotation_service(
                sort, mime_type=file.mime_type
            )
            for row in self.get_rows(files, annotation_service):
                writer.writerow(row)
        else:
            files = get_nondeleted_recycled_children_query(
                Files.id == file.id,
                children_filter=and_(
                    Files.mime_type == 'application/pdf', Files.recycling_date.is_(None)
                ),
                lazy_load_content=True,
            ).all()

            annotation_service = get_sorted_annotation_service(sort)
            for row in self.get_rows(files, annotation_service):
                writer.writerow(row)

        result = buffer.getvalue().encode('utf-8')

        return make_cacheable_file_response(
            request,
            result,
            etag=hashlib.sha256(result).hexdigest(),
            filename=f'{file.filename} - {sort} - Annotations.tsv',
            mime_type='text/tsv',
        )


class FileAnnotationGeneCountsView(FileAnnotationCountsView):
    def get_rows(self, files: List[Files]):
        arango_client = get_or_create_arango_client()
        manual_annotations_service = get_manual_annotation_service()

        yield [
            'gene_id',
            'gene_name',
            'organism_id',
            'organism_name',
            'gene_annotation_count',
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

        gene_organism_pairs = get_organisms_from_gene_ids(arango_client, gene_ids)
        sorted_pairs = sorted(
            gene_organism_pairs, key=lambda p: gene_ids[p['gene_id']], reverse=True
        )

        for pair in sorted_pairs:
            yield [
                pair['gene_id'],
                pair['gene_name'],
                pair['taxonomy_id'],
                pair['species_name'],
                gene_ids[pair['gene_id']],
            ]


class FilePDFAnnotationsGenerationView(FilesystemBaseView):
    @use_args(lambda request: BulkFileRequestSchema())
    @use_args(lambda request: AnnotationGenerationRequestSchema())
    def post(self, targets, params):
        """Generate annotations for one or more PDF files."""
        current_user = g.current_user

        files = self.get_nondeleted_recycled_files(
            Files.hash_id.in_(targets['hash_ids']), lazy_load_content=True
        )
        self.check_file_permissions(
            files, current_user, ['writable'], permit_recycled=False
        )

        override_organism = params.get('organism', None) or dict()
        override_annotation_configs = params.get('annotation_configs', None)

        missing = self.get_missing_hash_ids(targets['hash_ids'], files)

        results = {}
        global_exclusions = get_global_exclusion_annotations()
        for file in files:
            local_exclusions = [
                exc
                for exc in file.excluded_annotations
                if not exc.get('meta', {}).get('excludeGlobally', False)
            ]
            local_inclusions = file.custom_annotations

            try:
                send_pdf_annotation_request(
                    file.id,
                    global_exclusions,
                    local_exclusions,
                    local_inclusions,
                    override_organism.get('synonym', None),
                    override_organism.get('tax_id', None),
                    override_annotation_configs,
                )
            except Exception as e:
                results[file.hash_id] = {
                    'attempted': True,
                    'success': False,
                    'error': 'Invalid file type, can only annotate PDFs or Enrichment tables.',
                }
                current_app.logger.error(
                    f'Could not annotate file: {file.hash_id}, {file.filename}, {e}'
                )
            else:
                results[file.hash_id] = {
                    'attempted': True,
                    'success': True,
                    'error': '',
                }
                current_app.logger.info(
                    f'File annotation request successfully sent: {file.hash_id}, {file.filename}'
                )

        return jsonify(
            MultipleAnnotationGenerationResponseSchema().dump(
                {
                    'mapping': results,
                    'missing': missing,
                }
            )
        )


class FileEnrichmentTableAnnotationsGenerationView(FilesystemBaseView):
    @use_args(lambda request: BulkFileRequestSchema())
    @use_args(lambda request: AnnotationGenerationRequestSchema())
    def post(self, targets, params):
        """Generate annotations for one or more enrichment table files."""
        current_user = g.current_user

        files = self.get_nondeleted_recycled_files(
            Files.hash_id.in_(targets['hash_ids']), lazy_load_content=True
        )
        self.check_file_permissions(
            files, current_user, ['writable'], permit_recycled=False
        )

        override_organism = params.get('organism', None) or dict()
        override_annotation_configs = params.get('annotation_configs', None)

        missing = self.get_missing_hash_ids(targets['hash_ids'], files)

        results = {}
        global_exclusions = get_global_exclusion_annotations()
        for file in files:
            local_exclusions = [
                exc
                for exc in file.excluded_annotations
                if not exc.get('meta', {}).get('excludeGlobally', False)
            ]
            local_inclusions = file.custom_annotations

            try:
                raw_enrichment_data = json.loads(file.content.raw_file_utf8)
            except JSONDecodeError:
                current_app.logger.error(
                    f'Cannot annotate file with invalid content: {file.hash_id}, '
                    f'{file.filename}'
                )
                results[file.hash_id] = {
                    'attempted': False,
                    'success': False,
                    'error': 'Enrichment table content is not valid JSON.',
                }
                continue
            enrich_service = get_enrichment_table_service()
            enrichment_mapping = enrich_service.create_annotation_mappings(
                raw_enrichment_data
            )

            try:
                send_et_annotation_request(
                    file.id,
                    enrichment_mapping,
                    raw_enrichment_data,
                    global_exclusions,
                    local_exclusions,
                    local_inclusions,
                    override_organism.get('synonym', None),
                    override_organism.get('tax_id', None),
                    override_annotation_configs,
                )
            except Exception as e:
                results[file.hash_id] = {
                    'attempted': True,
                    'success': False,
                    'error': '',
                }
                current_app.logger.error(
                    f'Could not annotate file: {file.hash_id}, {file.filename}, {e}'
                )
            else:
                results[file.hash_id] = {
                    'attempted': True,
                    'success': True,
                    'error': '',
                }
                current_app.logger.info(
                    f'File annotation request successfully sent: {file.hash_id}, {file.filename}'
                )

        return jsonify(
            MultipleAnnotationGenerationResponseSchema().dump(
                {
                    'mapping': results,
                    'missing': missing,
                }
            )
        )


class RefreshEnrichmentAnnotationsView(FilesystemBaseView):
    @use_args(lambda request: BulkFileRequestSchema())
    def post(self, targets):
        """Clear out the annotations."""
        current_user = g.current_user

        files = self.get_nondeleted_recycled_files(
            Files.hash_id.in_(targets['hash_ids']), lazy_load_content=True
        )
        self.check_file_permissions(
            files, current_user, ['writable'], permit_recycled=False
        )

        updated_files = []
        for file in files:
            update = {
                'id': file.id,
                'annotations': [],
                'annotations_date': None,
                'enrichment_annotations': None,
            }
            updated_files.append(update)
        db.session.bulk_update_mappings(Files, updated_files)
        db.session.commit()
        # rollback in case of error?
        return jsonify({'results': 'Success'})


class GlobalAnnotationExportInclusions(MethodView):
    decorators = [requires_role('admin')]

    def get(self):
        yield g.current_user

        arango_client = get_or_create_arango_client()
        inclusions = execute_arango_query(
            db=get_db(arango_client),
            query=get_global_inclusions_query(),
        )

        file_uuids = {inclusion['file_reference'] for inclusion in inclusions}
        file_data_query = db.session.query(
            Files.hash_id.label('file_uuid'), Files.deleter_id.label('file_deleted_by')
        ).filter(Files.hash_id.in_([fid for fid in file_uuids]))

        file_uuids_map = {d.file_uuid: d.file_deleted_by for d in file_data_query}

        def get_inclusion_for_review(inclusion, file_uuids_map):
            user = AppUser.query.filter_by(
                id=file_uuids_map[inclusion['file_reference']]
            ).one_or_none()
            if user is None:
                deleter = None
            else:
                deleter = f'{user.username} ({user.first_name} {user.last_name})'

            return {
                'creator': inclusion['creator'],
                'file_uuid': inclusion['file_reference'],
                'file_deleted': deleter,
                'type': ManualAnnotationType.INCLUSION.value,
                'creation_date': convert_datetime(inclusion['creation_date']),
                'text': inclusion['synonym'],
                'case_insensitive': True,
                'entity_type': inclusion['entity_type'],
                'entity_id': inclusion['entity_id'],
                'reason': '',
                'comment': '',
            }

        data = [
            get_inclusion_for_review(inclusion, file_uuids_map)
            for inclusion in inclusions
            if inclusion['file_reference'] in file_uuids_map
        ]

        exporter = get_excel_export_service()
        response = make_response(exporter.get_bytes(data), HTTPStatus.OK)
        response.headers['Content-Type'] = exporter.mimetype
        response.headers[
            'Content-Disposition'
        ] = f'attachment; filename={exporter.get_filename("global_inclusions")}'
        yield response


class GlobalAnnotationExportExclusions(MethodView):
    decorators = [requires_role('admin')]

    def get(self):
        yield g.current_user

        exclusions = (
            db.session.query(
                GlobalList.id.label('global_list_id'),
                AppUser.username.label('creator'),
                Files.hash_id.label('file_uuid'),
                Files.deleter_id.label('file_deleted_by'),
                GlobalList.creation_date.label('creation_date'),
                GlobalList.annotation['text'].astext.label('text'),
                GlobalList.annotation['isCaseInsensitive'].astext.label(
                    'case_insensitive'
                ),
                GlobalList.annotation['type'].astext.label('entity_type'),
                GlobalList.annotation['id'].astext.label('entity_id'),
                GlobalList.annotation['reason'].astext.label('reason'),
                GlobalList.annotation['comment'].astext.label('comment'),
            )
            .join(AppUser, AppUser.id == GlobalList.annotation['user_id'].as_integer())
            .outerjoin(Files, Files.id == GlobalList.file_id)
            .filter(GlobalList.type == ManualAnnotationType.EXCLUSION.value)
            .order_by(sa.asc(GlobalList.annotation['text'].astext.label('text')))
        )

        def get_exclusion_for_review(exclusion):
            user = AppUser.query.filter_by(id=exclusion.file_deleted_by).one_or_none()
            deleter = f'User with id {exclusion.file_deleted_by} does not exist.'
            if user is None:
                deleter = None
            elif user:
                deleter = f'{user.username} ({user.first_name} {user.last_name})'

            return {
                'creator': exclusion.creator,
                'file_uuid': exclusion.file_uuid,
                'file_deleted_by': deleter,
                'type': ManualAnnotationType.EXCLUSION.value,
                'creation_date': str(exclusion.creation_date),
                'text': exclusion.text,
                'case_insensitive': True
                if exclusion.case_insensitive == 'true'
                else False,
                'entity_type': exclusion.entity_type,
                'entity_id': exclusion.entity_id,
                'reason': exclusion.reason,
                'comment': exclusion.comment,
            }

        data = [get_exclusion_for_review(exclusion) for exclusion in exclusions]

        exporter = get_excel_export_service()
        response = make_response(exporter.get_bytes(data), HTTPStatus.OK)
        response.headers['Content-Type'] = exporter.mimetype
        response.headers[
            'Content-Disposition'
        ] = f'attachment; filename={exporter.get_filename("global_exclusions")}'
        yield response


class GlobalAnnotationListView(MethodView):
    decorators = [requires_role('admin')]

    @use_args(PaginatedRequestSchema())
    @use_args(GlobalAnnotationTableType())
    def get(self, params, global_type):
        """Since we need to aggregate from two different
        sources, we'll just query (paginate) for x number of results from
        each and combine them together.
        """
        yield g.current_user

        limit = min(200, int(params.limit))
        page = max(1, int(params.page))

        if (
            global_type['global_annotation_type']
            == ManualAnnotationType.EXCLUSION.value
        ):
            exclusions = (
                db.session.query(
                    GlobalList.id.label('global_list_id'),
                    AppUser.username.label('creator'),
                    Files.hash_id.label('file_uuid'),
                    Files.deleter_id.label('file_deleted_by'),
                    GlobalList.creation_date.label('creation_date'),
                    GlobalList.annotation['text'].astext.label('text'),
                    GlobalList.annotation['isCaseInsensitive'].astext.label(
                        'case_insensitive'
                    ),
                    GlobalList.annotation['type'].astext.label('entity_type'),
                    GlobalList.annotation['id'].astext.label('entity_id'),
                    GlobalList.annotation['reason'].astext.label('reason'),
                    GlobalList.annotation['comment'].astext.label('comment'),
                )
                .join(
                    AppUser, AppUser.id == GlobalList.annotation['user_id'].as_integer()
                )
                .outerjoin(Files, Files.id == GlobalList.file_id)
                .filter(GlobalList.type == ManualAnnotationType.EXCLUSION.value)
                .order_by(sa.asc(GlobalList.annotation['text'].astext.label('text')))
                .paginate(page, limit)
            )

            data = [
                {
                    'global_id': r.global_list_id,
                    'creator': r.creator,
                    'file_uuid': r.file_uuid if r.file_uuid else '',
                    'file_deleted': True if r.file_deleted_by else False,
                    'type': ManualAnnotationType.EXCLUSION.value,
                    'creation_date': r.creation_date,
                    'text': r.text,
                    'case_insensitive': True if r.case_insensitive == 'true' else False,
                    'entity_type': r.entity_type,
                    'entity_id': r.entity_id,
                    'reason': r.reason,
                    'comment': r.comment,
                }
                for r in exclusions.items
            ]
            query_total = exclusions.total
        else:
            arango_client = get_or_create_arango_client()
            global_inclusions = execute_arango_query(
                db=get_db(arango_client),
                query=get_global_inclusions_paginated_query(),
                skip=0 if page == 1 else (page - 1) * limit,
                limit=limit,
            )

            file_uuids = {
                inclusion['file_reference'] for inclusion in global_inclusions
            }
            file_data_query = db.session.query(
                Files.hash_id.label('file_uuid'),
                Files.deleter_id.label('file_deleted_by'),
            ).filter(Files.hash_id.in_([fid for fid in file_uuids]))

            file_uuids_map = {d.file_uuid: d.file_deleted_by for d in file_data_query}
            data = [
                {
                    'global_id': i['node_internal_id'],
                    'synonym_id': i['syn_node_internal_id'],
                    'creator': i['creator'],
                    'file_uuid': i['file_reference'],
                    # if not in this something must've happened to the file
                    # since a global inclusion referenced it
                    # so mark it as deleted
                    # mapping is {file_uuid: user_id} where user_id is null if file is not deleted
                    'file_deleted': True
                    if file_uuids_map.get(i['file_reference'], True)
                    else False,
                    'type': ManualAnnotationType.INCLUSION.value,
                    'creation_date': convert_datetime(i['creation_date']),
                    'text': i['synonym'],
                    'case_insensitive': True,
                    'entity_type': i['entity_type'],
                    'entity_id': i['entity_id'],
                    'reason': '',
                    'comment': '',
                }
                for i in global_inclusions
            ]

            query_total = execute_arango_query(
                db=get_db(arango_client),
                query=get_global_inclusions_count_query(),
            )[0]['total']

        results = {'total': query_total, 'results': data}
        yield jsonify(GlobalAnnotationListSchema().dump(results))

    @use_args(GlobalAnnotationsDeleteSchema())
    @wrap_exceptions(ServerException, title='Could not delete exclusion')
    def delete(self, params):
        yield g.current_user

        # exclusions in postgres will not have synonym_id
        # those are for the graph nodes, and -1 represents not having one
        exclusion_pids = [gid for gid, sid in params['pids'] if sid == -1]
        inclusion_pids = [(gid, sid) for gid, sid in params['pids'] if sid != -1]

        with db.session.begin_nested():
            if exclusion_pids:
                query = GlobalList.__table__.delete().where(
                    GlobalList.id.in_(exclusion_pids)
                )
                try:
                    db.session.execute(query)
                except SQLAlchemyError as e:
                    raise ServerException(
                        title='Could not delete exclusion',
                        message='A database error occurred when deleting the global exclusion(s).',
                    ) from e
                else:
                    current_app.logger.info(
                        f'Deleted {len(exclusion_pids)} global exclusions',
                        extra=UserEventLog(
                            username=g.current_user.username,
                            event_type=LogEventType.ANNOTATION.value,
                        ).to_dict(),
                    )

            if inclusion_pids:
                manual_as = get_manual_annotation_service()
                try:
                    manual_as.remove_global_inclusions(inclusion_pids)
                    current_app.logger.info(
                        f'Deleted {len(inclusion_pids)} global inclusions',
                        extra=UserEventLog(
                            username=g.current_user.username,
                            event_type=LogEventType.ANNOTATION.value,
                        ).to_dict(),
                    )
                except Exception as e:
                    current_app.logger.error(
                        f'{str(e)}',
                        extra=UserEventLog(
                            username=g.current_user.username,
                            event_type=LogEventType.ANNOTATION.value,
                        ).to_dict(),
                    )
                    raise ServerException(
                        message='A database error occurred when deleting the global inclusion(s).'
                    ) from e

        yield jsonify(dict(result='success'))


@bp.route('/files/<int:file_id>', methods=['GET'])
# TODO: This really shouldn't be exempt. We either need to update the pdfparser to use auth
# credentials when pinging this endpoint, or we should block this endpoint via nginx and whitelist
# the pdfparser on that endpoint.
@login_exempt
@wrap_exceptions(AnnotationError)
def get_pdf_to_annotate(file_id):
    """This endpoint is sent by the annotation pipeline to the
    pdfparse service, and acts as a resource pull.
    """

    doc = Files.query.get(file_id)

    if not doc:
        raise FileNotFoundError(message=f'File with file id {file_id} not found.')

    res = make_response(doc.content.raw_file)
    res.headers['Content-Type'] = 'application/pdf'
    res.headers['Content-Disposition'] = f'attachment;filename={doc.filename}.pdf'
    return res


bp.add_url_rule(
    '/global-list',
    view_func=GlobalAnnotationListView.as_view('global_annotations_list'),
)
bp.add_url_rule(
    '/global-list/exclusions',
    view_func=GlobalAnnotationExportExclusions.as_view('export_global_exclusions'),
)
bp.add_url_rule(
    '/global-list/inclusions',
    view_func=GlobalAnnotationExportInclusions.as_view('export_global_inclusions'),
)
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations',
    view_func=FileAnnotationsView.as_view('file_annotations_list'),
)
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/enrichment/annotations',
    view_func=EnrichmentAnnotationsView.as_view('enrichment_file_annotations_list'),
)
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/custom',
    view_func=FileCustomAnnotationsListView.as_view('file_custom_annotations_list'),
)
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/custom/<string:uuid>',
    view_func=FileCustomAnnotationsDetailView.as_view('file_custom_annotations_detail'),
)
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/exclusions',
    view_func=FileAnnotationExclusionsListView.as_view(
        'file_annotation_exclusions_list'
    ),
)
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/counts',
    view_func=FileAnnotationCountsView.as_view('file_annotation_counts'),
)
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/sorted',
    view_func=FileAnnotationSortedView.as_view('file_annotation_sorted'),
)
filesystem_bp.add_url_rule(
    'objects/<string:hash_id>/annotations/gene-counts',
    view_func=FileAnnotationGeneCountsView.as_view('file_annotation_gene_counts'),
)
filesystem_bp.add_url_rule(
    'annotations/generate/pdf',
    view_func=FilePDFAnnotationsGenerationView.as_view(
        'file_pdf_annotation_generation'
    ),
)
filesystem_bp.add_url_rule(
    'annotations/generate/enrichment-table',
    view_func=FileEnrichmentTableAnnotationsGenerationView.as_view(
        'file_enrichment_table_annotation_generation'
    ),
)
filesystem_bp.add_url_rule(
    'annotations/refresh',
    # TODO: this can potentially become a generic annotations refresh
    view_func=RefreshEnrichmentAnnotationsView.as_view('refresh_annotations'),
)
