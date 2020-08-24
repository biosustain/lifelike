import io
import os

from datetime import datetime
from enum import Enum
from typing import Dict, List

from flask import Blueprint, current_app, g, make_response
from werkzeug.datastructures import FileStorage

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import (
    requires_role,
    requires_project_permission
)
from neo4japp.constants import TIMEZONE
from neo4japp.database import (
    db,
    get_annotations_service,
    get_annotations_pdf_parser,
    get_bioc_document_service,
    get_excel_export_service,
    get_lmdb_dao,
    get_manual_annotations_service,
    get_neo4j_service_dao,
)
from neo4japp.data_transfer_objects import AnnotationRequest
from neo4japp.exceptions import (
    AnnotationError,
    DatabaseError,
    RecordNotFoundException
)
from neo4japp.models import (
    AccessActionType,
    AppUser,
    Files,
    FileContent,
    GlobalList,
    Projects,
)
import neo4japp.models.files_queries as files_queries
from neo4japp.services.annotations.constants import (
    AnnotationMethod,
    EntityType,
    ManualAnnotationType,
)
from neo4japp.util import jsonify_with_class, SuccessResponse

bp = Blueprint('annotations', __name__, url_prefix='/annotations')


def annotate(
    doc: Files,
    annotation_method: str = AnnotationMethod.Rules.value,  # default to Rules Based
):
    lmdb_dao = get_lmdb_dao()
    pdf_parser = get_annotations_pdf_parser()
    annotator = get_annotations_service(lmdb_dao=lmdb_dao)
    bioc_service = get_bioc_document_service()

    fp = FileStorage(io.BytesIO(doc.raw_file), doc.filename)

    try:
        parsed_pdf_chars = pdf_parser.parse_pdf(pdf=fp)
        fp.close()
    except AnnotationError:
        raise AnnotationError(
            'Your file could not be imported. Please check if it is a valid PDF.'
            'If it is a valid PDF, please try uploading again.')

    tokens = pdf_parser.extract_tokens(parsed_chars=parsed_pdf_chars)
    pdf_text = pdf_parser.combine_all_chars(parsed_chars=parsed_pdf_chars)

    if annotation_method == AnnotationMethod.Rules.value:
        annotations = annotator.create_rules_based_annotations(
            tokens=tokens,
            custom_annotations=doc.custom_annotations,
        )
    elif annotation_method == AnnotationMethod.NLP.value:
        # NLP
        annotations = annotator.create_nlp_annotations(
            page_index=parsed_pdf_chars.min_idx_in_page,
            text=pdf_text,
            tokens=tokens,
            custom_annotations=doc.custom_annotations,
        )
    else:
        raise AnnotationError(f'Your file {doc.filename} could not be annotated.')
    bioc = bioc_service.read(text=pdf_text, file_uri=doc.filename)
    annotations_json = bioc_service.generate_bioc_json(
        annotations=annotations, bioc=bioc)

    current_app.logger.debug(
        f'File successfully annotated: {doc.file_id}, {doc.filename}')

    return {
        'id': doc.id,
        'annotations': annotations_json,
        'annotations_date': datetime.now(TIMEZONE),
    }


@bp.route('/<string:project_name>/<string:file_id>', methods=['POST'])
@auth.login_required
@jsonify_with_class(AnnotationRequest)
@requires_project_permission(AccessActionType.WRITE)
def annotate_file(req: AnnotationRequest, project_name: str, file_id: str):
    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()

    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found.')

    yield g.current_user, project

    doc = files_queries.get_all_files_and_content_by_id(
        file_ids=set([file_id]), project_id=project.id).one_or_none()

    if not doc:
        raise RecordNotFoundException(f'File with file id {file_id} not found.')

    annotated: List[dict] = []
    annotated.append(
        annotate(
            doc=doc,
            annotation_method=req.annotation_method,
        )
    )

    db.session.bulk_update_mappings(Files, annotated)
    db.session.commit()
    yield SuccessResponse(
        result={
            'filenames': doc.filename,
            'status': 'Successfully annotated.'
        },
        status_code=200)


class AnnotationOutcome(Enum):
    ANNOTATED = 'Annotated'
    NOT_ANNOTATED = 'Not annotated'
    NOT_FOUND = 'Not found'


@bp.route('/<string:project_name>/reannotate', methods=['POST'])
@auth.login_required
@jsonify_with_class(AnnotationRequest)
@requires_project_permission(AccessActionType.WRITE)
def reannotate(req: AnnotationRequest, project_name: str):
    user = g.current_user
    projects = Projects.query.filter(Projects.project_name == project_name).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    yield user, projects

    ids = set(req.file_ids)
    outcome: Dict[str, str] = {}  # file id to annotation outcome
    files = files_queries.get_all_files_and_content_by_id(
        file_ids=ids, project_id=projects.id).all()

    files_not_found = ids - set(f.file_id for f in files)
    for not_found in files_not_found:
        outcome[not_found] = AnnotationOutcome.NOT_FOUND.value

    updated_files: List[dict] = []

    for f in files:
        try:
            annotations = annotate(doc=f)
        except AnnotationError as e:
            current_app.logger.error(
                'Could not reannotate file: %s, %s, %s', f.file_id, f.filename, e)
            outcome[f.file_id] = AnnotationOutcome.NOT_ANNOTATED.value
        else:
            updated_files.append(annotations)
            current_app.logger.debug(
                'File successfully reannotated: %s, %s', f.file_id, f.filename)
            outcome[f.file_id] = AnnotationOutcome.ANNOTATED.value

    # low level fast bulk operation
    db.session.bulk_update_mappings(Files, updated_files)
    db.session.commit()
    yield SuccessResponse(result=outcome, status_code=200)


@bp.route('/global-list/inclusions')
@auth.login_required
@requires_role('admin')
def export_global_inclusions():
    yield g.current_user

    inclusions = GlobalList.query.filter_by(
        type=ManualAnnotationType.Inclusion.value,
        reviewed=False
    ).all()

    def get_inclusion_for_review(inclusion):
        user = AppUser.query.filter_by(id=inclusion.annotation['user_id']).one_or_none()
        username = f'{user.first_name} {user.last_name}' if user is not None else 'not found'
        hyperlink = 'not found'

        if inclusion.file_id is not None:
            domain = os.environ.get('DOMAIN')
            hyperlink = f'{domain}/api/files/download/{inclusion.file_id}'

        missing_data = any([
            inclusion.annotation['meta'].get('id', None) is None,
            inclusion.annotation['meta'].get('primaryLink', None) is None
        ])

        if missing_data:
            current_app.logger.warning(
                f'Found inclusion in the global list with missing data:\n{inclusion.to_dict()}'
            )

        return {
            'id': inclusion.annotation['meta'].get('id', ''),
            'term': inclusion.annotation['meta']['allText'],
            'type': inclusion.annotation['meta']['type'],
            'primary_link': inclusion.annotation['meta'].get('primaryLink', ''),
            'inclusion_date': inclusion.annotation.get('inclusion_date', ''),
            'user': username,
            'hyperlink': hyperlink
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
        type=ManualAnnotationType.Exclusion.value,
        reviewed=False,
    ).all()

    def get_exclusion_for_review(exclusion):
        user = AppUser.query.filter_by(id=exclusion.annotation['user_id']).one_or_none()
        username = f'{user.first_name} {user.last_name}' if user is not None else 'not found'
        hyperlink = 'not found'

        if exclusion.file_id is not None:
            domain = os.environ.get('DOMAIN')
            hyperlink = f'{domain}/api/files/download/{exclusion.file_id}'

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
            'hyperlink': hyperlink
        }

    data = [get_exclusion_for_review(exclusion) for exclusion in exclusions]

    exporter = get_excel_export_service()
    response = make_response(exporter.get_bytes(data), 200)
    response.headers['Content-Type'] = exporter.mimetype
    response.headers['Content-Disposition'] = \
        f'attachment; filename={exporter.get_filename("global_exclusions")}'
    yield response


@bp.route('/<string:project_name>/<string:file_id>')
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_all_annotations_from_file(project_name, file_id):
    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    user = g.current_user

    # yield to requires_project_permission
    yield user, project

    file = Files.query.filter_by(file_id=file_id, project=project.id).one_or_none()
    if not file:
        raise RecordNotFoundException('File does not exist')

    manual_annotations_service = get_manual_annotations_service()
    combined_annotations = manual_annotations_service.get_combined_annotations(project.id, file_id)

    distinct_annotations = {}
    for annotation in combined_annotations:
        annotation_data = (
            annotation['meta']['id'],
            annotation['meta']['type'],
            annotation['meta']['allText'],
        )

        if distinct_annotations.get(annotation_data, None) is not None:
            distinct_annotations[annotation_data] += 1
        else:
            distinct_annotations[annotation_data] = 1

    sorted_distinct_annotations = sorted(
        distinct_annotations,
        key=lambda annotation: distinct_annotations[annotation],
        reverse=True
    )

    result = 'entity_id\ttype\ttext\tcount\n'
    for annotation_data in sorted_distinct_annotations:
        result += f"{annotation_data[0]}\t{annotation_data[1]}\t{annotation_data[2]}\t{distinct_annotations[annotation_data]}\n"  # noqa

    response = make_response(result)
    response.headers['Content-Type'] = 'text/tsv'

    yield response


@bp.route('/<string:project_name>/<string:file_id>/genes')
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_gene_list_from_file(project_name, file_id):
    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    user = g.current_user

    # yield to requires_project_permission
    yield user, project

    file = Files.query.filter_by(file_id=file_id, project=project.id).one_or_none()
    if not file:
        raise RecordNotFoundException('File does not exist')

    manual_annotations_service = get_manual_annotations_service()
    combined_annotations = manual_annotations_service.get_combined_annotations(project.id, file_id)
    gene_ids = {}
    for annotation in combined_annotations:
        if annotation['meta']['type'] == EntityType.Gene.value:
            gene_id = annotation['meta']['id']
            if gene_ids.get(gene_id, None) is not None:
                gene_ids[gene_id] += 1
            else:
                gene_ids[gene_id] = 1

    neo4j = get_neo4j_service_dao()
    gene_organism_pairs = neo4j.get_organisms_from_gene_ids(
        gene_ids=list(gene_ids.keys())
    )
    sorted_pairs = sorted(gene_organism_pairs, key=lambda pair: gene_ids[pair['gene_id']], reverse=True)  # noqa

    result = 'gene_id\tgene_name\torganism_id\torganism_name\tgene_annotation_count\n'
    for pair in sorted_pairs:
        result += f"{pair['gene_id']}\t{pair['gene_name']}\t{pair['taxonomy_id']}\t{pair['species_name']}\t{gene_ids[pair['gene_id']]}\n"  # noqa

    response = make_response(result)
    response.headers['Content-Type'] = 'text/tsv'

    yield response
