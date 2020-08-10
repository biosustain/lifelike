import io
import os

from datetime import datetime

from flask import Blueprint, current_app, g, make_response
from werkzeug.datastructures import FileStorage

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_project_permission, requires_role
from neo4japp.constants import TIMEZONE
from neo4japp.database import (
    db,
    get_excel_export_service,
    get_annotations_service,
    get_annotations_pdf_parser,
    get_bioc_document_service,
    get_lmdb_dao,
)
from neo4japp.data_transfer_objects import AnnotationRequest
from neo4japp.exceptions import AnnotationError, RecordNotFoundException
from neo4japp.models import (
    AccessActionType,
    AppUser,
    Files,
    GlobalList,
    Projects,
)
import neo4japp.models.files_queries as files_queries
from neo4japp.services.annotations.constants import AnnotationMethod
from neo4japp.util import jsonify_with_class, SuccessResponse

bp = Blueprint('annotations', __name__, url_prefix='/annotations')


@bp.route('/<string:project_name>/<string:file_id>', methods=['POST'])
@auth.login_required
@jsonify_with_class(AnnotationRequest)
@requires_project_permission(AccessActionType.WRITE)
def annotate_file(
    req: AnnotationRequest,
    project_name: str,
    file_id: str,
):
    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()

    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found.')

    yield g.current_user, project

    docs = files_queries.get_all_files_and_content_by_id(
        file_ids=set([file_id]), project_id=project.id)

    if len(docs) == 0:
        raise RecordNotFoundException(f'File with file id {file_id} not found.')

    lmdb_dao = get_lmdb_dao()
    pdf_parser = get_annotations_pdf_parser()
    annotator = get_annotations_service(lmdb_dao=lmdb_dao)
    bioc_service = get_bioc_document_service()

    annotated = []
    filename = None
    for doc in docs:
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

        if req.annotation_method == AnnotationMethod.Rules.value:
            annotations = annotator.create_rules_based_annotations(
                tokens=tokens,
                custom_annotations=doc.custom_annotations,
            )
        elif req.annotation_method == AnnotationMethod.NLP.value:
            # NLP
            annotations = annotator.create_nlp_annotations(
                page_index=parsed_pdf_chars.min_idx_in_page,
                text=pdf_text,
                tokens=tokens,
                custom_annotations=doc.custom_annotations,
            )
        else:
            raise AnnotationError('Your file could not be annotated.')  # noqa
        bioc = bioc_service.read(text=pdf_text, file_uri=doc.filename)
        annotations_json = bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)
        filename = doc.filename

        annotated.append(
            {
                'id': doc.id,
                'annotations': annotations_json,
                'annotations_date': datetime.now(TIMEZONE),
            }
        )
        current_app.logger.debug(
            f'File successfully annotated: {doc.file_id}, {doc.filename}')
    db.session.bulk_update_mappings(Files, annotated)
    db.session.commit()
    yield SuccessResponse(
        result={
            'filename': filename,
            'status': 'Successfully annotated.'
        },
        status_code=200)


@bp.route('/global-list/inclusions')
@auth.login_required
@requires_role('admin')
def export_global_inclusions():
    yield g.current_user

    inclusions = GlobalList.query.filter_by(type='inclusion', reviewed=False).all()

    def get_inclusion_for_review(inclusion):
        user = AppUser.query.filter_by(id=inclusion.annotation['user_id']).one_or_none()
        username = f'{user.first_name} {user.last_name}' if user is not None else 'not found'
        hyperlink = 'not found'
        file = Files.query.filter_by(id=inclusion.file_id).one_or_none()
        if file is not None:
            domain = os.environ.get('DOMAIN')
            project = Projects.query.filter_by(id=file.project).one_or_none()
            hyperlink = f'{domain}/projects/{project.project_name}/files/{file.file_id}' \
                if project is not None else 'not found'

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

    exclusions = GlobalList.query.filter_by(type='exclusion', reviewed=False).all()

    def get_exclusion_for_review(exclusion):
        user = AppUser.query.filter_by(id=exclusion.annotation['user_id']).one_or_none()
        username = f'{user.first_name} {user.last_name}' if user is not None else 'not found'
        hyperlink = 'not found'
        file = Files.query.filter_by(id=exclusion.file_id).one_or_none()
        if file is not None:
            domain = os.environ.get('DOMAIN')
            project = Projects.query.filter_by(id=file.project).one_or_none()
            hyperlink = f'{domain}/projects/{project.project_name}/files/{file.file_id}' \
                if project is not None else 'not found'

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
