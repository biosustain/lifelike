import hashlib
import io
import json
import os
import re
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Optional
import urllib.request
from urllib.error import URLError

from flask import Blueprint, current_app, request, jsonify, g, make_response

from sqlalchemy.orm.exc import NoResultFound

from werkzeug.datastructures import FileStorage

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_role
from neo4japp.constants import TIMEZONE
from neo4japp.database import (
    db,
    get_annotations_service,
    get_annotations_pdf_parser,
    get_bioc_document_service,
    get_lmdb_dao,
)
from neo4japp.exceptions import (
    AnnotationError,
    FileUploadError,
    RecordNotFoundException,
    NotAuthorizedException,
)
from neo4japp.models import AppUser
from neo4japp.models.files import Files, FileContent, LMDBsDates
from neo4japp.utils.network import read_url
from neo4japp.schemas.files import (
    AnnotationAdditionSchema,
    AnnotationRemovalSchema,
    AnnotationExclusionSchema,
)
from flask_apispec import use_kwargs, marshal_with
from pdfminer import high_level

URL_FETCH_MAX_LENGTH = 1024 * 1024 * 30
URL_FETCH_TIMEOUT = 10
DOWNLOAD_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' \
                      'Chrome/51.0.2704.103 Safari/537.36 Lifelike'

bp = Blueprint('files', __name__, url_prefix='/files')


@bp.route('/upload', methods=['POST'])
@auth.login_required
def upload_pdf():
    filename = request.form['filename'].strip()
    pdf = None
    if 'url' in request.form:
        url = request.form['url']
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': DOWNLOAD_USER_AGENT,
            })
            data = read_url(req, max_length=URL_FETCH_MAX_LENGTH,
                            timeout=URL_FETCH_TIMEOUT).getvalue()
        except (ValueError, URLError):
            raise FileUploadError("Your file could not be downloaded, either because it is "
                                  "inaccessible or another problem occurred. Please double "
                                  "check the spelling of the URL.")
        pdf = FileStorage(io.BytesIO(data), filename)
    else:
        pdf = request.files['file']
    pdf_content = pdf.read()  # TODO: don't work with whole file in memory
    pdf.stream.seek(0)
    project = '1'  # TODO: remove hard coded project
    checksum_sha256 = hashlib.sha256(pdf_content).digest()
    user = g.current_user

    # TODO: Should `pdf.filename` be in sync with the final filename?
    # Make sure that the filename is not longer than the DB column permits
    max_filename_length = Files.filename.property.columns[0].type.length
    if len(filename) > max_filename_length:
        name, extension = os.path.splitext(filename)
        if len(extension) > max_filename_length:
            extension = ".dat"
        filename = name[:max(0, max_filename_length - len(extension))] + extension
    file_id = str(uuid.uuid4())

    annotations = annotate(filename, pdf)
    annotations_date = datetime.now(TIMEZONE)

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
        db.session.commit()

    description = request.form.get('description', '')
    doi = extract_doi(pdf_content, file_id, filename)
    upload_url = request.form.get('url', None)

    file = Files(
        file_id=file_id,
        filename=filename,
        description=description,
        content_id=file_content.id,
        user_id=user.id,
        annotations=annotations,
        annotations_date=annotations_date,
        project=project,
        doi=doi,
        upload_url=upload_url,
    )

    db.session.add(file)
    db.session.commit()

    current_app.logger.info(
        f'User uploaded file: <{g.current_user.email}:{file.filename}>')

    return jsonify({
        'file_id': file_id,
        'filename': filename,
        'status': 'Successfully uploaded'
    })


@bp.route('/list', methods=['GET'])
@auth.login_required
def list_files():
    """TODO: See JIRA LL-322
    """
    # TODO: remove hard coded project
    # Part of phase 1, as explained at https://github.com/SBRG/kg-prototypes/pull/85#issue-404823272
    project = '1'

    files = [{
        'annotations_date': row.annotations_date,
        'id': row.id,  # TODO: is this of any use?
        'file_id': row.file_id,
        'filename': row.filename,
        'description': row.description,
        'username': row.username,
        'creation_date': row.creation_date,
    } for row in db.session.query(
        Files.annotations_date,
        Files.id,
        Files.file_id,
        Files.filename,
        Files.description,
        Files.user_id,
        AppUser.username,
        Files.creation_date)
        .join(AppUser, Files.user_id == AppUser.id)
        .filter(Files.project == project)
        .order_by(Files.creation_date.desc())
        .all()]
    return jsonify({'files': files})


@bp.route('/<id>', methods=['GET', 'PATCH'])
@auth.login_required
def get_pdf(id):
    if request.method == 'PATCH':
        filename = request.form['filename'].strip()
        description = request.form['description'].strip()
        try:
            file = Files.query.filter_by(file_id=id).one()
        except NoResultFound:
            raise RecordNotFoundException('Requested PDF file not found.')
        else:
            if filename and filename != file.filename:
                db.session.query(Files).filter(Files.file_id == id).update({
                    'filename': filename,
                })
            if description != file.description:
                db.session.query(Files).filter(Files.file_id == id).update({
                    'description': description,
                })
            db.session.commit()
        return ''
    try:
        entry = db.session \
            .query(Files.id, FileContent.raw_file) \
            .join(FileContent, FileContent.id == Files.content_id) \
            .filter(Files.file_id == id) \
            .one()
    except NoResultFound:
        raise RecordNotFoundException('Requested PDF file not found.')
    res = make_response(entry.raw_file)
    res.headers['Content-Type'] = 'application/pdf'
    return res


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


@bp.route('/get_annotations/<id>', methods=['GET'])
@auth.login_required
def get_annotations(id):
    # data = request.get_json()
    # project = data['project']
    project = '1'  # TODO: remove hard coded project

    file = Files.query.filter_by(file_id=id, project=project).one_or_none()
    if file is None:
        raise RecordNotFoundException('File does not exist')

    # TODO: Should remove this eventually...the annotator should return data readable by the
    # lib-pdf-viewer-lib, or the lib should conform to what is being returned by the annotator.
    # Something has to give.
    def map_annotations_to_correct_format(unformatted_annotations: dict):
        unformatted_annotations_list = unformatted_annotations['documents'][0]['passages'][0]['annotations']  # noqa
        formatted_annotations_list = []

        for unformatted_annotation in unformatted_annotations_list:
            # Remove the 'keywordType' attribute and replace it with 'type', as the
            # lib-pdf-viewer-lib does not recognize 'keywordType'
            keyword_type = unformatted_annotation['meta']['keywordType']
            del unformatted_annotation['meta']['keywordType']
            unformatted_annotation['meta']['type'] = keyword_type

            formatted_annotations_list.append(unformatted_annotation)
        return formatted_annotations_list

    annotations = map_annotations_to_correct_format(file.annotations)

    # Add additional information for annotations that were excluded
    for annotation in annotations:
        for excluded_annotation in file.excluded_annotations:
            if excluded_annotation['id'] == annotation['meta']['id']:
                annotation['meta']['isExcluded'] = True
                annotation['meta']['exclusionReason'] = excluded_annotation['reason']
                annotation['meta']['exclusionComment'] = excluded_annotation['comment']

    # for now, custom annotations are stored in the format that pdf-viewer supports
    return jsonify(annotations + file.custom_annotations)


@bp.route('/add_custom_annotation/<id>', methods=['PATCH'])
@auth.login_required
@use_kwargs(AnnotationAdditionSchema(exclude=('uuid', 'user_id')))
@marshal_with(AnnotationAdditionSchema(only=('uuid',)), code=200)
def add_custom_annotation(id, **payload):
    annotation_to_add = {
        **payload,
        'user_id': g.current_user.id,
        'uuid': str(uuid.uuid4())
    }
    file = Files.query.filter_by(file_id=id).one_or_none()
    if file is None:
        raise RecordNotFoundException('File does not exist')
    file.custom_annotations = [annotation_to_add, *file.custom_annotations]
    db.session.commit()
    return annotation_to_add, 200


class AnnotationRemovalOutcome(Enum):
    REMOVED = 'Removed'
    NOT_OWNER = 'Not an owner'
    NOT_FOUND = 'Not found'


@bp.route('/remove_custom_annotation/<id>', methods=['PATCH'])
@auth.login_required
@use_kwargs(AnnotationRemovalSchema)
def remove_custom_annotation(id, uuid, removeAll):
    file = Files.query.filter_by(file_id=id).one_or_none()
    if file is None:
        raise RecordNotFoundException('File does not exist')
    user = g.current_user
    user_roles = [role.name for role in user.roles]
    uuids_to_remove = []
    annotation_to_remove = next(
        (ann for ann in file.custom_annotations if ann['uuid'] == uuid), None
    )
    outcome: Dict[str, str] = {}  # annotation uuid to deletion outcome
    if annotation_to_remove is None:
        outcome[uuid] = AnnotationRemovalOutcome.NOT_FOUND.value
        return jsonify(outcome)
    text = annotation_to_remove['meta']['allText']
    for annotation in file.custom_annotations:
        if (removeAll and annotation['meta']['allText'] == text or
                annotation['uuid'] == uuid):
            if annotation['user_id'] != user.id and 'admin' not in user_roles:
                outcome[annotation['uuid']] = AnnotationRemovalOutcome.NOT_CREATOR.value
                continue
            uuids_to_remove.append(annotation['uuid'])
            outcome[annotation['uuid']] = AnnotationRemovalOutcome.REMOVED.value
    file.custom_annotations = [
        ann for ann in file.custom_annotations if ann['uuid'] not in uuids_to_remove
    ]
    db.session.commit()
    return jsonify(outcome)


def annotate(filename, pdf_file_object) -> dict:
    lmdb_dao = get_lmdb_dao()
    pdf_parser = get_annotations_pdf_parser()
    annotator = get_annotations_service(lmdb_dao=lmdb_dao)
    bioc_service = get_bioc_document_service()
    try:
        parsed_pdf_chars = pdf_parser.parse_pdf(pdf=pdf_file_object)
    except AnnotationError:
        raise AnnotationError('Your file could not be imported. Please check if it is a valid PDF.')

    try:
        tokens = pdf_parser.extract_tokens(parsed_chars=parsed_pdf_chars)
        pdf_text_list = pdf_parser.combine_chars_into_words(parsed_pdf_chars)
        pdf_text = ' '.join([text for text, _ in pdf_text_list])
        annotations = annotator.create_annotations(tokens=tokens)
        bioc = bioc_service.read(text=pdf_text, file_uri=filename)
        return bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)
    except AnnotationError:
        raise AnnotationError('Your file could not be annotated and your PDF file was not saved.')


class AnnotationOutcome(Enum):
    ANNOTATED = 'Annotated'
    NOT_ANNOTATED = 'Not annotated'
    NOT_FOUND = 'Not found'


@bp.route('/reannotate', methods=['POST'])
@auth.login_required
def reannotate():
    ids = request.get_json()
    outcome: Dict[str, str] = {}  # file id to annotation outcome
    for id in ids:
        file = db.session \
            .query(Files.id, Files.filename, Files.annotations, FileContent.raw_file) \
            .join(FileContent, FileContent.id == Files.content_id) \
            .filter(Files.file_id == id) \
            .one_or_none()
        if file is None:
            current_app.logger.error('Could not find file: %s, %s', id, file.filename)
            outcome[id] = AnnotationOutcome.NOT_FOUND.value
            continue
        fp = io.BytesIO(file.raw_file)
        try:
            annotations = annotate(file.filename, fp)
        except Exception as e:
            current_app.logger.error('Could not annotate file: %s, %s, %s', id, file.filename, e)
            outcome[id] = AnnotationOutcome.NOT_ANNOTATED.value
        else:
            db.session.query(Files).filter(Files.file_id == id).update({
                'annotations': annotations,
                'annotations_date': datetime.now(timezone.utc),
            })
            db.session.commit()
            current_app.logger.debug('File successfully annotated: %s, %s', id, file.filename)
            outcome[id] = AnnotationOutcome.ANNOTATED.value
        fp.close()
    return jsonify(outcome)


class DeletionOutcome(Enum):
    DELETED = 'Deleted'
    NOT_OWNER = 'Not an owner'
    NOT_FOUND = 'Not found'


@bp.route('/bulk_delete', methods=['DELETE'])
@auth.login_required
def delete_files():
    curr_user = g.current_user
    user_roles = [r.name for r in curr_user.roles]
    ids = request.get_json()
    outcome: Dict[str, str] = {}  # file id to deletion outcome
    for id in ids:
        file = Files.query.filter_by(file_id=id).one_or_none()
        if file is None:
            current_app.logger.error('Could not find file: %s, %s', id, file.filename)
            outcome[id] = DeletionOutcome.NOT_FOUND.value
            continue
        if 'admin' not in user_roles and curr_user.id != int(file.user_id):
            current_app.logger.error('Cannot delete file (not an owner): %s, %s', id, file.filename)
            outcome[id] = DeletionOutcome.NOT_OWNER.value
            continue
        db.session.delete(file)
        db.session.commit()
        current_app.logger.info(f'User deleted file: <{g.current_user.email}:{file.filename}>')
        outcome[id] = DeletionOutcome.DELETED.value

    return jsonify(outcome)


def extract_doi(pdf_content: bytes, file_id: str = None, filename: str = None) -> Optional[str]:
    # Attempt 1: search through the first N bytes (most probably containing only metadata)
    chunk = pdf_content[:2**17]
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


@bp.route('/add_annotation_exclusion/<file_id>', methods=['PATCH'])
@auth.login_required
@use_kwargs(AnnotationExclusionSchema)
def add_annotation_exclusion(file_id, **payload):
    excluded_annotation = {
        **payload,
        'user_id': g.current_user.id,
        'exclusion_date': str(datetime.now(TIMEZONE))
    }
    file = Files.query.filter_by(file_id=file_id).one_or_none()
    if file is None:
        raise RecordNotFoundException('File does not exist')
    file.excluded_annotations = [excluded_annotation, *file.excluded_annotations]
    db.session.commit()
    return jsonify({'status': 'success'})


@bp.route('/remove_annotation_exclusion/<file_id>', methods=['PATCH'])
@auth.login_required
@use_kwargs(AnnotationExclusionSchema(only=('id',)))
def remove_annotation_exclusion(file_id, id):
    file = Files.query.filter_by(file_id=file_id).one_or_none()
    if file is None:
        raise RecordNotFoundException('File does not exist')
    excluded_annotation = next(
        (ann for ann in file.excluded_annotations if ann['id'] == id), None
    )
    if excluded_annotation is None:
        raise RecordNotFoundException('Annotation not found')
    user = g.current_user
    user_roles = [role.name for role in user.roles]
    if excluded_annotation['user_id'] != user.id and 'admin' not in user_roles:
        raise NotAuthorizedException('Another user has excluded this annotation')
    file.excluded_annotations = list(file.excluded_annotations)
    file.excluded_annotations.remove(excluded_annotation)
    db.session.merge(file)
    db.session.commit()
    return jsonify({'status': 'success'})


@bp.route('/lmdbs_dates', methods=['GET'])
@auth.login_required
def get_lmdbs_dates():
    rows = LMDBsDates.query.all()
    return {row.name: row.date for row in rows}
