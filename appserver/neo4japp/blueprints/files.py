import hashlib
import io
import json
import os
import re
import urllib.request
import uuid
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional
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
    Directory,
    Projects,
    LMDBsDates
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


def get_file(file_id: str, user: AppUser, check_access: AccessActionType,
             with_content=False) -> Files:
    t_owner = aliased(AppUser)
    t_directory = aliased(Directory)
    t_project = aliased(Projects)

    file_query = db.session.query(Files) \
        .join(t_owner, t_owner.id == Files.user_id) \
        .join(t_directory, t_directory.id == Files.dir_id) \
        .join(t_project, t_project.id == t_directory.projects_id) \
        .options(contains_eager(Files.user, alias=t_owner),
                 contains_eager(Files.dir, alias=t_directory)
                 .contains_eager(Directory.project, t_project)) \
        .filter(Files.file_id == file_id)

    if with_content:
        t_file_content = aliased(FileContent)
        file_query = file_query.join(t_file_content, t_file_content.id == Files.content_id) \
            .options(contains_eager(Files.content, alias=t_file_content))

    # Pull up map by hash_id
    try:
        file = file_query.one()
    except NoResultFound:
        raise RecordNotFoundException('File not found.')

    check_project_permission(file.dir.project, user, check_access)

    return file


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
    try:
        doi = match.group(1).decode('utf-8').replace('%2F', '/')
    except Exception:
        return None
    # Make sure that the match does not contain undesired characters at the end.
    # E.g. when the match is at the end of a line, and there is a full stop.
    while doi and doi[-1] in './%':
        doi = doi[:-1]
    return doi if doi.startswith('http') else f'https://doi.org/{doi}'


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


@newbp.route('/directory/<int:directory_id>/<string:filename>', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.WRITE)
def validate_filename(
        directory_id: int,
        filename: str,
):
    user = g.current_user

    try:
        directory = Directory.query.get(directory_id)
        projects = Projects.query.get(directory.projects_id)
    except NoResultFound as err:
        raise RecordNotFoundException(f'No record found: {err}.')

    yield user, projects

    exist = files_queries.filename_exist(
        filename=filename,
        directory_id=directory_id,
        project_id=projects.id)
    yield jsonify({'result': not exist}), 200


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

        # check if filename already exists in directory/project
        # this is needed in case the API is called directly
        exist = files_queries.filename_exist(
            filename=filename,
            directory_id=directory.id,
            project_id=projects.id)

        if exist:
            raise DuplicateRecord('Filename already exists, please choose a different one.')

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

        current_app.logger.info(
            f'User uploaded file: <{filename}>',
            extra=UserEventLog(
                username=g.current_user.username, event_type='file upload').to_dict())
    except (SQLAlchemyError, Exception):
        # if index_pdf fail then do not save file
        # otherwise creates a false representation for the user
        # since they will see the file uploaded, but
        # cannot search for the file
        db.session.rollback()
        raise FileUploadError('Your file could not be saved. Please try uploading again.')
    else:
        db.session.commit()

    yield SuccessResponse(
        result={
            'file_id': file_id,
            'filename': filename,
            'status': 'Successfully uploaded'
        },
        status_code=200
    )


@bp.route('/download/<int:file_content_id>', methods=['GET'])
@auth.login_required
@requires_role('admin')
def download(file_content_id: int):
    FILENAME = "FileReference"

    yield g.current_user

    try:
        entry = db.session.query(
            FileContent.raw_file
        ).filter(
            FileContent.id == file_content_id,
        ).one()
    except NoResultFound:
        raise RecordNotFoundException('Requested PDF file not found.')

    res = make_response(entry.raw_file)
    res.headers['Content-Type'] = 'application/pdf'
    res.headers['Content-Disposition'] = f'attachment;filename={FILENAME}.pdf'
    yield res


# TODO: Is this used???
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
        'modified_date': row.modified_date,
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
        Files.modified_date,
        Files.doi,
        Files.upload_url)
        .join(AppUser, Files.user_id == AppUser.id)
        .filter(Files.project == projects_id)
        .order_by(Files.creation_date.desc())
        .all()]
    yield jsonify({'files': files})


@newbp.route('/<string:project_name>/files/<string:id>/info', methods=['GET', 'PATCH'])
@auth.login_required
def get_file_info(id: str, project_name: str):
    user = g.current_user

    file = get_file(id, user, AccessActionType.READ)

    return jsonify({
        'id': file.id,  # TODO: is this of any use?
        'file_id': file.file_id,
        'filename': file.filename,
        'description': file.description,
        'username': file.user.username,
        'creation_date': file.creation_date,
        'dir_id': file.dir_id,
        'modified_date': file.modified_date,
        'doi': file.doi,
        'upload_url': file.upload_url,
        'project_name': file.project_.project_name,
    })


@newbp.route('/<string:project_name>/files/<string:file_id>/associated-maps', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_associated_maps(file_id: str, project_name: str):
    user = g.current_user

    projects = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if projects is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    yield user, projects

    # Limit length of string just in case
    file_id = file_id[:100]

    query = f"""
    SELECT
        DISTINCT
        map.id
        , map.hash_id
        , map.label
        , map.author
        , map.dir_id
    FROM (
        SELECT
            p.id
            , data
        FROM project p
        CROSS JOIN json_to_recordset(json_extract_path(graph, 'nodes')) AS data(data JSON)
        UNION ALL
        SELECT
            p.id
            , data
        FROM project p
        CROSS JOIN json_to_recordset(json_extract_path(graph, 'edges')) AS data(data JSON)
    ) data
    CROSS JOIN json_to_recordset(json_extract_path(data.data, 'sources')) AS source(url VARCHAR)
    INNER JOIN project map ON map.id = data.id
    INNER JOIN directory dir ON dir.id = map.dir_id
    INNER JOIN projects project ON project.id = dir.projects_id
    LEFT JOIN projects_collaborator_role pcr ON pcr.projects_id = project.id
    LEFT JOIN app_role on pcr.app_role_id = app_role.id
    LEFT JOIN appuser role_user on pcr.appuser_id = role_user.id
    WHERE
        (
            url ~ :url_1
            OR url ~ :url_2
        )
        AND (
            map.public = true OR (
                app_role.name IN ('project-read', 'project-write', 'project-admin')
                AND role_user.id = :user_id
            )
        )
    """

    results = db.session.execute(
        query,
        {
            'url_1': f'/projects/(?:[^/]+)/files/{re.escape(file_id)}(?:#.*)?',
            'url_2': f'/dt/pdf/{re.escape(file_id)}(?:#.*)?',
            'user_id': g.current_user.id,
        }
    ).fetchall()

    directory_project_query_result = db.session.query(
        Directory.id,
        Projects.project_name
    ).filter(
        Directory.id.in_([row[4] for row in results])
    ).join(
        Projects,
        Projects.id == Directory.projects_id
    ).all()

    dir_project_map = {
        dir_id: project_name
        for (dir_id, project_name) in directory_project_query_result
    }

    yield jsonify([
        {
            'hash_id': row[1],
            'label': row[2],
            'author': row[3],
            'project_name': dir_project_map[row[4]]
        } for row in results
    ])


@newbp.route('/<string:project_name>/files/<string:id>', methods=['GET', 'PATCH'])
@auth.login_required
def get_pdf(id: str, project_name: str):
    user = g.current_user

    if request.method == 'PATCH':
        filename = request.form['filename'].strip()
        description = request.form['description'].strip()
        fallback_organism = json.loads(request.form.get('organism', '{}'))

        try:
            file = get_file(id, user, AccessActionType.WRITE)
        except RecordNotFoundException as e:
            raise RecordNotFoundException('Requested PDF file not found.')
        else:
            # TODO: maybe move these into a separate service file?
            update: Dict[str, str] = {}
            if filename and filename != file.filename:
                # If name ends in .enrichment remove .enrichment.
                if (filename[-11:] == '.enrichment'):
                    filename = filename[:-11]
                update['filename'] = filename

            if description != file.description:
                update['description'] = description

            if update:
                try:
                    db.session.query(Files).filter(Files.file_id == id).update(update)
                except SQLAlchemyError:
                    db.session.rollback()
                    raise DatabaseError('Failed to update PDF filename and/or description.')  # noqa

            curr_fallback = FallbackOrganism.query.get(file.fallback_organism_id)

            if not fallback_organism:
                if curr_fallback:
                    # fallback organism was removed
                    try:
                        file.fallback_organism = None
                        db.session.delete(curr_fallback)
                    except SQLAlchemyError:
                        db.session.rollback()
                        raise DatabaseError('Failed to delete fallback organism from the PDF.')  # noqa
            else:
                if (not curr_fallback or
                        (curr_fallback.organism_name != fallback_organism['organism_name']
                         and curr_fallback.organism_synonym != fallback_organism['synonym']
                         and curr_fallback.organism_taxonomy_id != fallback_organism['tax_id'])):  # noqa

                    # no match so probably a new fallback organism
                    new_fallback = FallbackOrganism(
                        organism_name=fallback_organism['organism_name'],
                        organism_synonym=fallback_organism['synonym'],
                        organism_taxonomy_id=fallback_organism['tax_id']
                    )

                    try:
                        db.session.add(new_fallback)
                        db.session.flush()
                        file.fallback_organism = new_fallback
                        if curr_fallback:
                            db.session.delete(curr_fallback)
                    except SQLAlchemyError:
                        db.session.rollback()
                        raise DatabaseError('There was a problem updating fallback organism for the PDF.')  # noqa

            try:
                db.session.commit()

                # .update (see the call above) doesn't invoke the ORM event mappers (see "Warnings"
                # under https://docs.sqlalchemy.org/en/13/orm/query.html?highlight=query%20update#sqlalchemy.orm.query.Query.update),  # noqa
                # so we have to manually update elastic
                elastic_service = get_elastic_service()
                elastic_service.delete_documents_with_index(
                    file_ids=[file.file_id],
                    index_id=FILE_INDEX_ID
                )
                elastic_service.index_files([file.id])
            except SQLAlchemyError:
                db.session.rollback()
                raise DatabaseError('Unexpected error occurred updating PDF.')
        return ''

    file = get_file(id, user, AccessActionType.READ, with_content=True)
    res = make_response(file.content.raw_file)
    res.headers['Content-Type'] = 'application/pdf'

    return res


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


@newbp.route('/<string:project_name>/files/<string:id>/annotations', methods=['GET'])
@auth.login_required
def get_annotations(id: str, project_name: str):
    user = g.current_user
    file = get_file(id, user, AccessActionType.READ)

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

    return jsonify(annotations + file.custom_annotations)


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
        project.id, file_id, uuid, removeAll, user_id=user.id
    )

    yield jsonify(removed_annotation_uuids)


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

    # low level fast bulk operation
    deleted_file_ids = [to_delete.file_id for to_delete in files_to_delete]
    deleted_file_names = [to_delete.filename for to_delete in files_to_delete]

    try:
        delete_query = Files.__table__.delete().where(
            Files.file_id.in_(set(deleted_file_ids)))
        db.session.execute(delete_query)
    except SQLAlchemyError:
        db.session.rollback()
        raise DatabaseError('Failed to delete file(s).')
    else:
        db.session.commit()

        for deleted in deleted_file_names:
            current_app.logger.info(
                f'User deleted file: <{deleted}>',
                extra=UserEventLog(
                    username=g.current_user.username, event_type='file delete').to_dict())
            outcome[deleted] = DeletionOutcome.DELETED.value

        # Delete these files from elasticsearch. We have to do this manually here because of the
        # bulk deletion above.
        elastic_service = get_elastic_service()
        elastic_service.delete_documents_with_index(
            file_ids=deleted_file_ids,
            index_id=FILE_INDEX_ID
        )

    yield jsonify(outcome)


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


@newbp.route('/<string:project_name>/files/<string:id>/move', methods=['POST'])
@auth.login_required
@use_kwargs(MoveFileRequest)
def move_file(destination: DirectoryDestination, id: str, project_name: str):
    user = g.current_user

    target_file, target_directory, target_project = db.session.query(Files, Directory, Projects) \
        .join(Directory, Directory.id == Files.dir_id) \
        .join(Projects, Projects.id == Directory.projects_id) \
        .filter(Files.file_id == id,
                Projects.project_name == project_name) \
        .one()

    check_project_permission(target_project, user, AccessActionType.WRITE)

    destination_dir, destination_project = db.session.query(Directory, Projects) \
        .join(Projects, Projects.id == Directory.projects_id) \
        .filter(Directory.id == destination['directoryId']) \
        .one()

    if destination_project.id != target_project.id:
        check_project_permission(destination_project, user, AccessActionType.WRITE)

    if target_directory.id == destination_dir.id:
        raise InvalidArgumentsException(
            'The destination directory is the same as the current directory.')

    target_file.project = destination_project.id
    target_file.dir_id = destination_dir.id
    db.session.commit()

    return jsonify({
        'success': True,
    })
