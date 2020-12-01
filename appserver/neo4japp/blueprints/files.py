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

from flask import Blueprint, current_app, request, jsonify, g, make_response
from flask_apispec import use_kwargs, marshal_with
from pdfminer import high_level
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import aliased, contains_eager
from sqlalchemy.orm.exc import NoResultFound
from werkzeug.datastructures import FileStorage

import neo4japp.models.files_queries as files_queries
from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_project_permission, \
    requires_role, check_project_permission
# TODO: LL-415 Migrate the code to the projects folder once GUI is complete and API refactored
from neo4japp.blueprints.projects import bp as newbp
from neo4japp.constants import FILE_INDEX_ID
from neo4japp.data_transfer_objects import FileUpload
from neo4japp.database import db, get_manual_annotations_service, get_elastic_service
from neo4japp.exceptions import (
    DatabaseError,
    DuplicateRecord,
    FileUploadError,
    RecordNotFoundException,
    InvalidArgumentsException,
)
from neo4japp.models import (
    AccessActionType,
    AppUser,
    FallbackOrganism,
    Files,
    FileContent,
    Projects,
    LMDBsDates,
)
from neo4japp.request_schemas.annotations import (
    AnnotationAdditionSchema,
    AnnotationSchema,
    AnnotationRemovalSchema,
    AnnotationExclusionSchema,
)
from neo4japp.request_schemas.filesystem import MoveFileRequest, DirectoryDestination
from neo4japp.util import jsonify_with_class, SuccessResponse
from neo4japp.utils.logger import UserEventLog
from neo4japp.utils.network import read_url

URL_FETCH_MAX_LENGTH = 1024 * 1024 * 30
URL_FETCH_TIMEOUT = 10
DOWNLOAD_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' \
                      'Chrome/51.0.2704.103 Safari/537.36 Lifelike'

bp = Blueprint('files', __name__, url_prefix='/files')


@newbp.route('/<string:projects_name>/enrichment-table', methods=['POST'])
@auth.login_required
@requires_project_permission(AccessActionType.WRITE)
def add_gene_list(projects_name: str):
    data = request.get_json()
    user = g.current_user

    try:
        projects = Projects.query.filter(Projects.project_name == projects_name).one()
    except NoResultFound:
        raise RecordNotFoundException('Project could not be found.')
    yield g.current_user, projects

    dir_id = data['directoryId']
    enrichment_data = data['enrichmentData'].encode('utf-8')

    try:
        checksum_sha256 = hashlib.sha256(enrichment_data).digest()

        try:
            # First look for an existing copy of this file
            file_content = db.session.query(FileContent.id) \
                .filter(FileContent.checksum_sha256 == checksum_sha256) \
                .one()
        except NoResultFound:
            # Otherwise, let's add the file content to the database
            file_content = FileContent(
                raw_file=enrichment_data,
                checksum_sha256=checksum_sha256
            )
            db.session.add(file_content)
            db.session.flush()

        file_id = str(uuid.uuid4())
        filename = data['filename']

        file = Files(
            file_id=file_id,
            filename=filename + '.enrichment',
            description=data['description'],
            content_id=file_content.id,
            user_id=user.id,
            project=projects.id,
            dir_id=dir_id,
        )

        db.session.add(file)
        db.session.commit()

        current_app.logger.info(
            f'User uploaded file: <{filename}>',
            extra=UserEventLog(
                username=g.current_user.username, event_type='file upload').to_dict())
    except Exception:
        raise FileUploadError('Your file could not be saved. Please try creating again.')

    yield jsonify({'status': 'success', 'filename': filename + '.enrichment'}), 200


@newbp.route('/<string:projects_name>/enrichment-table/<string:fileId>', methods=['PATCH'])
@auth.login_required
@requires_project_permission(AccessActionType.WRITE)
def edit_gene_list(projects_name: str, fileId: str):
    data = request.get_json()
    user = g.current_user

    try:
        projects = Projects.query.filter(Projects.project_name == projects_name).one()
    except NoResultFound:
        raise RecordNotFoundException('Project could not be found.')
    yield g.current_user, projects

    enrichment_data = data['enrichmentData'].encode('utf-8')
    checksum_sha256 = hashlib.sha256(enrichment_data).digest()
    file_name = data['name']

    try:
        entry_file = Files.query.filter(
            Files.file_id == fileId,
            Files.project == projects.id
        ).one()

        # If file type enrichment table add .enrichment to new name if it doesn't have .enrichment.
        if (file_name[-11:] != '.enrichment' and entry_file.filename[-11:] == '.enrichment'):
            file_name = file_name + '.enrichment'

        # If file type enrichment table remove .enrichment from new name if it has .enrichment.
        if (file_name[-11:] == '.enrichment' and entry_file.filename[-11:] != '.enrichment'):
            file_name = file_name[:-11]

        try:
            # First look for an existing copy of this file
            file_content = db.session.query(FileContent.id) \
                .filter(FileContent.checksum_sha256 == checksum_sha256) \
                .one()
        except NoResultFound:
            # Otherwise, let's add the file content to the database
            file_content = FileContent(
                raw_file=enrichment_data,
                checksum_sha256=checksum_sha256
            )
            db.session.add(file_content)
            db.session.flush()

        entry_file.filename = file_name
        entry_file.description = data['description']
        entry_file.content_id = file_content.id

        db.session.add(entry_file)
        db.session.commit()

    except NoResultFound:
        raise RecordNotFoundException('Requested file not found.')

    yield jsonify({'status': 'success'}), 200


@newbp.route('/<string:projects_name>/enrichment-table/<string:id>', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_enrichment_data(id: str, projects_name: str):
    user = g.current_user

    try:
        projects = Projects.query.filter(Projects.project_name == projects_name).one()
    except NoResultFound:
        raise RecordNotFoundException(f'Project {projects_name} not found')

    yield user, projects

    try:
        entry = db.session.query(
            Files.id,
            Files.filename,
            Files.description,
            FileContent.raw_file
        ).join(
            FileContent,
            FileContent.id == Files.content_id
        ).filter(
            Files.file_id == id,
            Files.project == projects.id
        ).one()
    except NoResultFound:
        raise RecordNotFoundException('Requested file not found.')

    yield jsonify({
        'status': 'success',
        'data': entry.raw_file.decode('utf-8'),
        'name': entry.filename,
        'description': entry.description}), 200


# TODO: Convert this? Where is this getting used
@bp.route('/bioc', methods=['GET'])
@auth.login_required
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


@newbp.route('/<string:project_name>/files/<string:file_id>/fallback-organism', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_file_fallback_organism(project_name: str, file_id):
    projects = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if projects is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    user = g.current_user

    yield user, projects

    file = Files.query.filter_by(file_id=file_id, project=projects.id).one_or_none()
    if not file:
        raise RecordNotFoundException('File does not exist')

    organism_taxonomy_id = None
    if file.fallback_organism:
        organism_taxonomy_id = file.fallback_organism.organism_taxonomy_id
    yield jsonify({'result': organism_taxonomy_id})
