import hashlib
import io
import json
import os
import re
import urllib.request
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional
from urllib.error import URLError

from flask import Blueprint, current_app, request, jsonify, g
from flask_apispec import use_kwargs, marshal_with
from pdfminer import high_level
from sqlalchemy.orm.exc import NoResultFound
from werkzeug.datastructures import FileStorage

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_project_permission
# TODO: LL-415 Migrate the code to the projects folder once GUI is complete and API refactored
from neo4japp.blueprints.projects import bp as newbp
from neo4japp.data_transfer_objects import FileUpload
from neo4japp.database import db, get_manual_annotations_service
from neo4japp.exceptions import (
    FileUploadError,
    RecordNotFoundException,
)
from neo4japp.models import (
    AccessActionType,
    Files,
    FileContent,
    Projects,
    LMDBsDates
)
from neo4japp.request_schemas.annotations import (
    AnnotationAdditionSchema,
    AnnotationSchema,
    AnnotationRemovalSchema,
    AnnotationExclusionSchema,
)
from neo4japp.services.indexing import index_pdf
from neo4japp.util import jsonify_with_class, SuccessResponse
from neo4japp.utils.logger import UserEventLog
from neo4japp.utils.network import read_url

URL_FETCH_MAX_LENGTH = 1024 * 1024 * 30
URL_FETCH_TIMEOUT = 10
DOWNLOAD_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' \
                      'Chrome/51.0.2704.103 Safari/537.36 Lifelike'

bp = Blueprint('files', __name__, url_prefix='/files')


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
    current_app.logger.info(
        'No DOI for file: %s, %s', file_id, filename,
        extra=UserEventLog(username=g.current_user.username, event_type='missing DOI').to_dict())
    return None


def search_doi(content: bytes) -> Optional[str]:
    # ref: https://stackoverflow.com/a/10324802
    # Has a good breakdown of the DOI specifications,
    # in case need to play around with the regex in the future
    doi_re = rb'(?i)(?:doi:\s*|https?:\/\/doi\.org\/)(10[.][0-9]{4,}(?:[.][0-9]+)*\/(?:(?!["&\'<>])\S)+)\b'  # noqa
    match = re.search(doi_re, content)

    if match is None:
        return None
    doi = match.group(1).decode('utf-8').replace('%2F', '/')
    # Make sure that the match does not contain undesired characters at the end.
    # E.g. when the match is at the end of a line, and there is a full stop.
    while doi and doi[-1] in './%':
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
            f'User uploaded file: <{filename}>',
            extra=UserEventLog(
                username=g.current_user.username, event_type='file upload').to_dict())
        index_pdf.populate_single_index(file.id)
    except Exception:
        raise FileUploadError('Your file could not be saved. Please try uploading again.')

    yield SuccessResponse(
        result={
            'file_id': file_id,
            'filename': filename,
            'status': 'Successfully uploaded'
        },
        status_code=200
    )


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
    manual_annotations_service = get_manual_annotations_service()

    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    user = g.current_user

    yield user, project

    inclusions = manual_annotations_service.add_inclusions(
        project.id, file_id, user.id, payload['annotation'], payload['annotateAll']
    )

    yield inclusions, 200


@newbp.route('/<string:project_name>/files/<string:file_id>/annotations/remove', methods=['PATCH'])
@auth.login_required
@use_kwargs(AnnotationRemovalSchema)
@requires_project_permission(AccessActionType.WRITE)
def remove_custom_annotation(file_id, uuid, removeAll, project_name):
    manual_annotations_service = get_manual_annotations_service()

    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    user = g.current_user

    yield user, project

    removed_annotation_uuids = manual_annotations_service.remove_inclusions(
        project.id, file_id, uuid, removeAll
    )

    yield jsonify(removed_annotation_uuids)


@newbp.route(
    '/<string:project_name>/files/<string:file_id>/annotations/add_annotation_exclusion',
    methods=['PATCH'])
@auth.login_required
@use_kwargs(AnnotationExclusionSchema)
@requires_project_permission(AccessActionType.WRITE)
def add_annotation_exclusion(project_name: str, file_id: str, **payload):
    manual_annotations_service = get_manual_annotations_service()

    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    user = g.current_user

    yield user, project

    manual_annotations_service.add_exclusion(project.id, file_id, user.id, payload)

    yield jsonify({'status': 'success'})


@newbp.route(
    '/<string:project_name>/files/<string:file_id>/annotations/remove_annotation_exclusion',
    methods=['PATCH'])
@auth.login_required
@use_kwargs(AnnotationExclusionSchema(only=('type', 'text')))
@requires_project_permission(AccessActionType.WRITE)
def remove_annotation_exclusion(project_name, file_id, type, text):
    manual_annotations_service = get_manual_annotations_service()

    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    user = g.current_user

    yield user, project

    manual_annotations_service.remove_exclusion(project.id, file_id, user.id, type, text)

    yield jsonify({'status': 'success'})


@bp.route('/lmdbs_dates', methods=['GET'])
@auth.login_required
def get_lmdbs_dates():
    rows = LMDBsDates.query.all()
    return {row.name: row.date for row in rows}
