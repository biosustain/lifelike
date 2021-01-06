import hashlib
import json
import os
import uuid
from datetime import datetime

from flask import Blueprint, current_app, request, jsonify, g
from sqlalchemy.orm.exc import NoResultFound

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_project_permission
# TODO: LL-415 Migrate the code to the projects folder once GUI is complete and API refactored
from neo4japp.blueprints.projects import bp as newbp
from neo4japp.database import db
from neo4japp.exceptions import (
    FileUploadError,
    RecordNotFoundException,
)
from neo4japp.models import (
    AccessActionType,
    Files,
    FileContent,
    Projects,
    LMDBsDates,
)
from neo4japp.utils.logger import UserEventLog

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
        projects = Projects.query.filter(Projects.name == projects_name).one()
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

    try:
        projects = Projects.query.filter(Projects.name == projects_name).one()
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

        current_app.logger.info(
            f'Project: {projects_name}, File ID: {fileId}',
            extra=UserEventLog(
                username=g.current_user.username, event_type='edit gene list').to_dict()
        )

    except NoResultFound:
        raise RecordNotFoundException('Requested file not found.')

    yield jsonify({'status': 'success'}), 200


@newbp.route('/<string:projects_name>/enrichment-table/<string:id>', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_enrichment_data(id: str, projects_name: str):
    user = g.current_user

    try:
        projects = Projects.query.filter(Projects.name == projects_name).one()
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

    current_app.logger.info(
        f'Project: {projects_name}, File ID: {id}',
        extra=UserEventLog(
            username=g.current_user.username, event_type='open enrichment file').to_dict()
    )

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


@bp.route('/lmdbs_dates', methods=['GET'])
@auth.login_required
def get_lmdbs_dates():
    rows = LMDBsDates.query.all()
    return {row.name: row.date for row in rows}


@newbp.route('/<string:project_name>/files/<string:file_id>/fallback-organism', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_file_fallback_organism(project_name: str, file_id):
    projects = Projects.query.filter(Projects.name == project_name).one_or_none()
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
