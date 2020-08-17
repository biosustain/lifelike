import hashlib
import io
import json
import os
import re
import urllib.request
import uuid

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional
from urllib.error import URLError

from flask import Blueprint, current_app, request, jsonify, g, make_response
from sqlalchemy.orm.exc import NoResultFound
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_project_permission, requires_role
# TODO: LL-415 Migrate the code to the projects folder once GUI is complete and API refactored
from neo4japp.blueprints.projects import bp as newbp
from neo4japp.constants import TIMEZONE
from neo4japp.database import (
    db,
    get_annotations_service,
    get_annotations_pdf_parser,
    get_bioc_document_service,
    get_excel_export_service,
    get_lmdb_dao,
    get_neo4j_service_dao,
)
from neo4japp.data_transfer_objects import FileUpload
from neo4japp.exceptions import (
    AnnotationError,
    FileUploadError,
    RecordNotFoundException,
    NotAuthorizedException,
)
from neo4japp.models import (
    AccessActionType,
    AppUser,
    Files,
    FileContent,
    Directory,
    Projects,
    LMDBsDates
)
import neo4japp.models.files_queries as files_queries
from neo4japp.request_schemas.annotations import (
    AnnotationAdditionSchema,
    AnnotationSchema,
    AnnotationRemovalSchema,
    AnnotationExclusionSchema,
)
from neo4japp.services.indexing import index_pdf
from neo4japp.utils.network import read_url
from neo4japp.services.annotations.constants import AnnotationMethod, EntityType
from neo4japp.services.annotations.manual_annotations import ManualAnnotationsService
from neo4japp.util import jsonify_with_class, SuccessResponse
from flask_apispec import use_kwargs, marshal_with
from pdfminer import high_level

URL_FETCH_MAX_LENGTH = 1024 * 1024 * 30
URL_FETCH_TIMEOUT = 10
DOWNLOAD_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' \
                      'Chrome/51.0.2704.103 Safari/537.36 Lifelike'

bp = Blueprint('files', __name__, url_prefix='/files')


def annotate(
    filename: str,
    pdf_fp: FileStorage,
    custom_annotations: List[dict],
    annotation_method: str = AnnotationMethod.Rules.value,  # default to Rules Based
) -> dict:
    lmdb_dao = get_lmdb_dao()
    pdf_parser = get_annotations_pdf_parser()
    annotator = get_annotations_service(lmdb_dao=lmdb_dao)
    bioc_service = get_bioc_document_service()
    try:
        parsed_pdf_chars = pdf_parser.parse_pdf(pdf=pdf_fp)
    except AnnotationError as exc:
        raise AnnotationError(
            'Your file could not be imported. Please check if it is a valid PDF.', [str(exc)])

    tokens = pdf_parser.extract_tokens(parsed_chars=parsed_pdf_chars)
    pdf_text = pdf_parser.combine_all_chars(parsed_chars=parsed_pdf_chars)

    if annotation_method == AnnotationMethod.Rules.value:
        annotations = annotator.create_rules_based_annotations(
            tokens=tokens,
            custom_annotations=custom_annotations,
        )
    elif annotation_method == AnnotationMethod.NLP.value:
        # NLP
        annotations = annotator.create_nlp_annotations(
            page_index=parsed_pdf_chars.min_idx_in_page,
            text=pdf_text,
            tokens=tokens,
            custom_annotations=custom_annotations,
        )
    else:
        raise AnnotationError('Your file could not be annotated.')  # noqa
    bioc = bioc_service.read(text=pdf_text, file_uri=filename)
    return bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)


def extract_doi(pdf_content: bytes, file_id: str = None, filename: str = None) -> Optional[str]:
    # Attempt 1: search through the first N bytes (most probably containing only metadata)
    chunk = pdf_content[:2 ** 17]
    doi = search_doi(chunk)
    if doi is not None:
        return doi

    # Attempt 2: search through the first two pages of text (no metadata)
    fp = io.BytesIO(pdf_content)
    text = high_level.extract_text(fp, page_numbers=[0, 1], caching=False)
    doi = search_doi(bytes(text, encoding='utf8'))
    if doi is not None:
        return doi

    current_app.logger.warning('No DOI for file: %s, %s', file_id, filename)
    return None


def search_doi(content: bytes) -> Optional[str]:
    doi_re = rb'(?:doi|DOI)(?::|=)\s*([\d\w\./%]+)'
    match = re.search(doi_re, content)
    if match is None:
        return None
    doi = match.group(1).decode('utf-8').replace('%2F', '/')
    # Make sure that the match does not contain undesired characters at the end.
    # E.g. when the match is at the end of a line, and there is a full stop.
    while doi[-1] in './%':
        doi = doi[:-1]
    return doi if doi.startswith('http') else f'https://doi.org/{doi}'


@bp.route('/upload', methods=['POST'])
@newbp.route('/<string:project_name>/files', methods=['POST'])  # TODO: use this once LL-415 done
@auth.login_required
@jsonify_with_class(FileUpload, has_file=True)
@requires_project_permission(AccessActionType.WRITE)
def upload_pdf(request, project_name: str):

    user = g.current_user
    filename = request.filename.strip()

    try:
        directory = Directory.query.get(request.directory_id)
        projects = Projects.query.get(directory.projects_id)
    except NoResultFound as err:
        raise RecordNotFoundException(f'No record found: {err}')

    yield user, projects

    if request.url:
        url = request.url
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': DOWNLOAD_USER_AGENT,
            })
            data = read_url(req, max_length=URL_FETCH_MAX_LENGTH,
                            timeout=URL_FETCH_TIMEOUT).getvalue()
        except (ValueError, URLError):
            raise FileUploadError('Your file could not be downloaded, either because it is '
                                  'inaccessible or another problem occurred. Please double '
                                  'check the spelling of the URL.')
        pdf = FileStorage(io.BytesIO(data), filename)
    else:
        pdf = request.file_input

    try:
        pdf_content = pdf.read()  # TODO: don't work with whole file in memory
        pdf.stream.seek(0)

        checksum_sha256 = hashlib.sha256(pdf_content).digest()

        # TODO: Should `pdf.filename` be in sync with the final filename?
        # Make sure that the filename is not longer than the DB column permits
        max_filename_length = Files.filename.property.columns[0].type.length
        if len(filename) > max_filename_length:
            name, extension = os.path.splitext(filename)
            if len(extension) > max_filename_length:
                extension = ".dat"
            filename = name[:max(0, max_filename_length - len(extension))] + extension
        file_id = str(uuid.uuid4())

        try:
            # First look for an existing copy of this file
            file_content = db.session.query(FileContent.id) \
                .filter(FileContent.checksum_sha256 == checksum_sha256) \
                .one()
        except NoResultFound:
            # Otherwise, let's add the file content to the database
            file_content = FileContent(
                raw_file=pdf_content,
                checksum_sha256=checksum_sha256
            )
            db.session.add(file_content)
            db.session.flush()

        description = request.description
        doi = extract_doi(pdf_content, file_id, filename)
        upload_url = request.url

        file = Files(
            file_id=file_id,
            filename=filename,
            description=description,
            content_id=file_content.id,
            user_id=user.id,
            project=projects.id,
            dir_id=directory.id,
            doi=doi,
            upload_url=upload_url,
        )

        db.session.add(file)
        db.session.commit()

        current_app.logger.info(
            f'User uploaded file: <{g.current_user.email}:{file.filename}>')
        index_pdf.populate_single_index(file.id)
    except Exception:
        raise FileUploadError('Your file could not be saved. Please try uploading again.')

    try:
        annotations = annotate(
            filename=filename,
            pdf_fp=pdf,
            custom_annotations=file.custom_annotations or [],
            annotation_method=request.annotation_method,
        )
        annotations_date = datetime.now(TIMEZONE)

        file.annotations = annotations
        file.annotations_date = annotations_date
        db.session.add(file)
    except AnnotationError:
        # do nothing if annotations fail
        # file should still be uploaded
        # due to LL-1371
        raise  # bubble up the exception
    db.session.commit()

    yield SuccessResponse(
        result={
            'file_id': file_id,
            'filename': filename,
            'status': 'Successfully uploaded'
        },
        status_code=200
    )


@newbp.route('/<string:project_name>/files', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def list_files(project_name: str):

    projects = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if projects is None:
        raise RecordNotFoundException(f'Project {project_name} not found')
    projects_id = projects.id

    user = g.current_user

    yield user, projects

    # TODO: this needs to be paginated
    files = [{
        'annotations_date': row.annotations_date,
        'id': row.id,  # TODO: is this of any use?
        'file_id': row.file_id,
        'filename': row.filename,
        'description': row.description,
        'username': row.username,
        'creation_date': row.creation_date,
        'doi': row.doi,
        'upload_url': row.upload_url
    } for row in db.session.query(
        Files.annotations_date,
        Files.id,
        Files.file_id,
        Files.filename,
        Files.description,
        Files.user_id,
        AppUser.username,
        Files.creation_date,
        Files.doi,
        Files.upload_url)
        .join(AppUser, Files.user_id == AppUser.id)
        .filter(Files.project == projects_id)
        .order_by(Files.creation_date.desc())
        .all()]
    yield jsonify({'files': files})


@newbp.route('/<string:project_name>/files/<string:id>/info', methods=['GET', 'PATCH'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_file_info(id: str, project_name: str):

    user = g.current_user

    projects = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if projects is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    yield user, projects

    try:
        row = db.session.query(
                Files.id,
                Files.file_id,
                Files.filename,
                Files.description,
                Files.user_id,
                AppUser.username,
                Files.creation_date,
                Files.doi,
                Files.upload_url
            ).join(
                AppUser,
                Files.user_id == AppUser.id
            ).filter(
                Files.file_id == id,
                Files.project == projects.id
            ).one()
    except NoResultFound:
        raise RecordNotFoundException('Requested PDF file not found.')

    yield jsonify({
        'id': row.id,  # TODO: is this of any use?
        'file_id': row.file_id,
        'filename': row.filename,
        'description': row.description,
        'username': row.username,
        'creation_date': row.creation_date,
        'doi': row.doi,
        'upload_url': row.upload_url
    })


@newbp.route('/<string:project_name>/files/<string:id>', methods=['GET', 'PATCH'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_pdf(id: str, project_name: str):

    user = g.current_user

    projects = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if projects is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    yield user, projects

    if request.method == 'PATCH':
        filename = request.form['filename'].strip()
        description = request.form['description'].strip()
        try:
            file = Files.query.filter_by(file_id=id).one()
        except NoResultFound:
            raise RecordNotFoundException('Requested PDF file not found.')
        else:
            update: Dict[str, str] = {}
            if filename and filename != file.filename:
                update['filename'] = filename

            if description != file.description:
                update['description'] = description

            if update:
                db.session.query(Files).filter(Files.file_id == id).update(update)
                db.session.commit()
        yield ''

    try:
        entry = db.session.query(
            Files.id,
            FileContent.raw_file
        ).join(
            FileContent,
            FileContent.id == Files.content_id
        ).filter(
            Files.file_id == id,
            Files.project == projects.id
        ).one()
    except NoResultFound:
        raise RecordNotFoundException('Requested PDF file not found.')

    res = make_response(entry.raw_file)
    res.headers['Content-Type'] = 'application/pdf'

    yield res


# TODO: Convert this? Where is this getting used
@bp.route('/bioc', methods=['GET'])
def transform_to_bioc():
    TEMPLATE_PATH = os.path.abspath(os.getcwd()) + '/templates/bioc.json'
    with open(TEMPLATE_PATH, 'r') as f:
        data = request.get_json()
        current_time = datetime.now()
        template = json.load(f)
        template['date'] = current_time.strftime('%Y-%m-%d')
        template['id'] = data['id']
        template['documents'][0]['passages'][0]['text'] = data['text']
        template['documents'][0]['passages'][0]['annotations'] = data['annotations']
        return jsonify(template)


@newbp.route('/<string:project_name>/files/<string:id>/annotations', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_annotations(id: str, project_name: str):

    projects = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if projects is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    user = g.current_user

    yield user, projects

    file = Files.query.filter_by(file_id=id, project=projects.id).one_or_none()
    if not file:
        raise RecordNotFoundException('File does not exist')

    if file.annotations:
        annotations = file.annotations['documents'][0]['passages'][0]['annotations']

        # Add additional information for annotations that were excluded
        for annotation in annotations:
            for exclusion in file.excluded_annotations:
                if (exclusion.get('type') == annotation['meta']['type'] and
                        exclusion.get('text', True) == annotation.get('textInDocument', False)):
                    annotation['meta']['isExcluded'] = True
                    annotation['meta']['exclusionReason'] = exclusion['reason']
                    annotation['meta']['exclusionComment'] = exclusion['comment']
    else:
        annotations = []

    yield jsonify(annotations + file.custom_annotations)


@newbp.route('/<string:project_name>/files/<string:file_id>/annotations/add', methods=['PATCH'])
@use_kwargs(AnnotationAdditionSchema(exclude=('annotation.uuid',)))
@marshal_with(AnnotationSchema(many=True), code=200)
@auth.login_required
@requires_project_permission(AccessActionType.WRITE)
def add_custom_annotation(file_id, project_name, **payload):

    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    user = g.current_user

    yield user, project

    inclusions = ManualAnnotationsService.add_inclusions(
        project.id, file_id, user.id, payload['annotation'], payload['annotateAll']
    )

    yield inclusions, 200


@newbp.route('/<string:project_name>/files/<string:file_id>/annotations/remove', methods=['PATCH'])
@auth.login_required
@use_kwargs(AnnotationRemovalSchema)
@requires_project_permission(AccessActionType.WRITE)
def remove_custom_annotation(file_id, uuid, removeAll, project_name):

    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    user = g.current_user

    yield user, project

    removed_annotation_uuids = ManualAnnotationsService.remove_inclusions(
        project.id, file_id, uuid, removeAll
    )

    yield jsonify(removed_annotation_uuids)


class AnnotationOutcome(Enum):
    ANNOTATED = 'Annotated'
    NOT_ANNOTATED = 'Not annotated'
    NOT_FOUND = 'Not found'


@newbp.route('/<string:project_name>/files/reannotate', methods=['POST'])
@auth.login_required
@requires_project_permission(AccessActionType.WRITE)
def reannotate(project_name: str):
    user = g.current_user
    projects = Projects.query.filter(Projects.project_name == project_name).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    yield user, projects

    ids = set(request.get_json())
    outcome: Dict[str, str] = {}  # file id to annotation outcome
    files = files_queries.get_all_files_and_content_by_id(file_ids=ids, project_id=projects.id)

    files_not_found = ids - set(f.file_id for f in files)
    for not_found in files_not_found:
        outcome[not_found] = AnnotationOutcome.NOT_FOUND.value

    updated_files: List[dict] = []

    for f in files:
        fp = FileStorage(io.BytesIO(f.raw_file), f.filename)
        try:
            annotations = annotate(
                filename=f.filename,
                pdf_fp=fp,
                custom_annotations=f.custom_annotations,
            )
        except AnnotationError as e:
            current_app.logger.error(
                'Could not reannotate file: %s, %s, %s', f.file_id, f.filename, e)
            outcome[f.file_id] = AnnotationOutcome.NOT_ANNOTATED.value
        else:
            updated_files.append(
                {
                    'id': f.id,
                    'annotations': annotations,
                    'annotations_date': datetime.now(timezone.utc),
                }
            )
            current_app.logger.debug(
                'File successfully reannotated: %s, %s', f.file_id, f.filename)
            outcome[f.file_id] = AnnotationOutcome.ANNOTATED.value
        fp.close()

    # low level fast bulk operation
    db.session.bulk_update_mappings(Files, updated_files)
    db.session.commit()
    yield jsonify(outcome)


class DeletionOutcome(Enum):
    DELETED = 'Deleted'
    NOT_OWNER = 'Not an owner'
    NOT_FOUND = 'Not found'


@newbp.route('/<string:project_name>/files', methods=['DELETE'])
@auth.login_required
@requires_project_permission(AccessActionType.WRITE)
def delete_files(project_name: str):
    curr_user = g.current_user

    projects = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if projects is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    yield curr_user, projects

    user_roles = [r.name for r in curr_user.roles]
    ids = set(request.get_json())
    outcome: Dict[str, str] = {}  # file id to deletion outcome
    files = files_queries.get_all_files_by_id(file_ids=ids, project_id=projects.id)

    files_not_found = ids - set(f.file_id for f in files)
    for not_found in files_not_found:
        outcome[not_found] = DeletionOutcome.NOT_FOUND.value

    files_to_delete: List[Files] = []

    for f in files:
        if 'admin' not in user_roles and curr_user.id != int(f.user_id):
            current_app.logger.error(
                'Cannot delete file (not an owner): %s, %s', f.file_id, f.filename)
            outcome[f.file_id] = DeletionOutcome.NOT_OWNER.value
        else:
            files_to_delete.append(f)

    for deleted in files_to_delete:
        current_app.logger.info(f'User deleted file: <{g.current_user.email}:{deleted.filename}>')
        outcome[deleted.file_id] = DeletionOutcome.DELETED.value

    # low level fast bulk operation
    delete_query = Files.__table__.delete().where(
        Files.file_id.in_(set(to_delete.file_id for to_delete in files_to_delete)))
    db.session.execute(delete_query)
    db.session.commit()

    yield jsonify(outcome)


@newbp.route(
    '/<string:project_name>/files/<string:file_id>/annotations/add_annotation_exclusion',
    methods=['PATCH'])
@auth.login_required
@use_kwargs(AnnotationExclusionSchema)
@requires_project_permission(AccessActionType.WRITE)
def add_annotation_exclusion(project_name: str, file_id: str, **payload):

    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    user = g.current_user

    yield user, project

    ManualAnnotationsService.add_exclusion(project.id, file_id, user.id, payload)

    yield jsonify({'status': 'success'})


@newbp.route(
    '/<string:project_name>/files/<string:file_id>/annotations/remove_annotation_exclusion',
    methods=['PATCH'])
@auth.login_required
@use_kwargs(AnnotationExclusionSchema(only=('type', 'text')))
@requires_project_permission(AccessActionType.WRITE)
def remove_annotation_exclusion(project_name, file_id, type, text):

    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    user = g.current_user

    yield user, project

    ManualAnnotationsService.remove_exclusion(project.id, file_id, user.id, type, text)

    yield jsonify({'status': 'success'})


@bp.route('/lmdbs_dates', methods=['GET'])
@auth.login_required
def get_lmdbs_dates():
    rows = LMDBsDates.query.all()
    return {row.name: row.date for row in rows}


@bp.route('/global_exclusion_file')
@auth.login_required
@requires_role('admin')
def export_excluded_annotations():
    yield g.current_user

    files = db.session.query(
        Files.filename,
        Files.file_id,
        Files.project,
        Files.excluded_annotations,
    ).all()

    def get_exclusion_for_review(filename, file_id, project_id, exclusion):
        user = AppUser.query.filter_by(id=exclusion['user_id']).one_or_none()
        project = Projects.query.filter_by(id=project_id).one_or_none()
        domain = os.environ.get('DOMAIN')
        return {
            'id': exclusion['id'],
            'text': exclusion.get('text', ''),
            'type': exclusion.get('type', ''),
            'reason': exclusion['reason'],
            'comment': exclusion['comment'],
            'exclusion_date': exclusion['exclusion_date'],
            'user': f'{user.first_name} {user.last_name}' if user is not None else 'not found',
            'filename': filename,
            'hyperlink': f'{domain}/projects/{project.project_name}/files/{file_id}'
                    if project is not None else 'not found'
        }

    data = [get_exclusion_for_review(filename, file_id, project_id, exclusion)
            for filename, file_id, project_id, exclusions in files for exclusion in exclusions]

    exporter = get_excel_export_service()
    response = make_response(exporter.get_bytes(data), 200)
    response.headers['Content-Type'] = exporter.mimetype
    response.headers['Content-Disposition'] = \
        f'attachment; filename={exporter.get_filename("excluded_annotations")}'
    yield response


@bp.route('/global_inclusion_file')
@auth.login_required
@requires_role('admin')
def export_included_annotations():
    yield g.current_user

    files = db.session.query(
        Files.filename,
        Files.file_id,
        Files.project,
        Files.custom_annotations,
    ).all()

    def get_inclusion_for_review(filename, file_id, project_id, inclusion):
        user = AppUser.query.filter_by(id=inclusion['user_id']).one_or_none()
        project = Projects.query.filter_by(id=project_id).one_or_none()
        domain = os.environ.get('DOMAIN')
        return {
            'text': inclusion['meta']['allText'],
            'type': inclusion['meta']['type'],
            'primary_link': inclusion['meta'].get('primaryLink', ''),
            'inclusion_date': inclusion.get('inclusion_date', ''),
            'user': f'{user.first_name} {user.last_name}' if user is not None else 'not found',
            'filename': filename,
            'hyperlink': f'{domain}/projects/{project.project_name}/files/{file_id}'
                    if project is not None else 'not found'
        }

    data = [get_inclusion_for_review(filename, file_id, project_id, inclusion)
            for filename, file_id, project_id, inclusions in files for inclusion in inclusions]

    exporter = get_excel_export_service()
    response = make_response(exporter.get_bytes(data), 200)
    response.headers['Content-Type'] = exporter.mimetype
    response.headers['Content-Disposition'] = \
        f'attachment; filename={exporter.get_filename("included_annotations")}'
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

    combined_annotations = ManualAnnotationsService.get_combined_annotations(project.id, file_id)
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
    response.headers['Content-Type'] = 'text/csv'

    yield response
