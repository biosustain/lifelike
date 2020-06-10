import hashlib
import io
import json
import os
import uuid
from datetime import datetime
from enum import Enum
from typing import Dict
import urllib.request
from urllib.error import URLError

from flask import Blueprint, current_app, request, jsonify, g, make_response

from sqlalchemy.orm.exc import NoResultFound

from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_role
from neo4japp.database import (
    db,
    get_annotations_service,
    get_annotations_pdf_parser,
    get_bioc_document_service,
    get_lmdb_dao,
)
from neo4japp.exceptions import AnnotationError, RecordNotFoundException
from neo4japp.models import AppUser
from neo4japp.models.files import Files, FileContent
from neo4japp.utils.network import read_url

URL_FETCH_MAX_LENGTH = 1024 * 1024 * 30
URL_FETCH_TIMEOUT = 10
DOWNLOAD_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' \
                      'Chrome/51.0.2704.103 Safari/537.36 Lifelike'

bp = Blueprint('files', __name__, url_prefix='/files')


@bp.route('/upload', methods=['POST'])
@auth.login_required
def upload_pdf():
    filename = None
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
            raise AnnotationError("Your file could not be downloaded, either because it is "
                                  "inaccessible or another problem occurred. Please double "
                                  "check the spelling of the URL.")
        filename = secure_filename(request.form['filename'])
        if not filename.lower().endswith('.pdf'):
            filename += '.pdf'
        pdf = FileStorage(io.BytesIO(data), filename)
    else:
        filename = secure_filename(request.files['file'].filename)
        pdf = request.files['file']
    pdf_content = pdf.read()  # TODO: don't work with whole file in memory
    pdf.stream.seek(0)
    project = '1'  # TODO: remove hard coded project
    checksum_sha256 = hashlib.sha256(pdf_content).digest()
    user = g.current_user

    # Make sure that the filename is not longer than the DB column permits
    max_filename_length = Files.filename.property.columns[0].type.length
    if len(filename) > max_filename_length:
        name, extension = os.path.splitext(filename)
        if len(extension) > max_filename_length:
            extension = ".dat"
        filename = name[:max(0, max_filename_length - len(extension))] + extension
    file_id = str(uuid.uuid4())

    annotations = annotate(filename, pdf)

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

    file = Files(
        file_id=file_id,
        filename=filename,
        content_id=file_content.id,
        user_id=user.id,
        annotations=annotations,
        project=project
    )
    db.session.add(file)
    db.session.commit()

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
        'id': row.id,  # TODO: is this of any use?
        'file_id': row.file_id,
        'filename': row.filename,
        'username': row.username,
        'creation_date': row.creation_date,
    } for row in db.session.query(
        Files.id,
        Files.file_id,
        Files.filename,
        Files.user_id,
        AppUser.username,
        Files.creation_date)
        .join(AppUser, Files.user_id == AppUser.id)
        .filter(Files.project == project)
        .order_by(Files.creation_date.desc())
        .all()]
    return jsonify({'files': files})


@bp.route('/<id>', methods=['GET'])
@auth.login_required
def get_pdf(id):
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
    if not file:
        raise RecordNotFoundException('File does not exist')

    annotations = file.annotations

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

    # for now, custom annotations are stored in the format that pdf-viewer supports
    return jsonify(map_annotations_to_correct_format(annotations) + file.custom_annotations)


@bp.route('/add_custom_annotation/<id>', methods=['PATCH'])
@auth.login_required
def add_custom_annotation(id):
    annotation_to_add = request.get_json()
    annotation_to_add['user_id'] = g.current_user.id
    annotation_to_add['uuid'] = str(uuid.uuid4())
    file = Files.query.filter_by(file_id=id).one_or_none()
    if not file:
        raise RecordNotFoundException('File does not exist')
    file.custom_annotations = [annotation_to_add, *file.custom_annotations]
    db.session.commit()
    return jsonify({'uuid': annotation_to_add['uuid']})


@bp.route('/delete_custom_annotations/<id>', methods=['PATCH'])
@auth.login_required
def delete_custom_annotation(id):
    file = Files.query.filter_by(file_id=id).one_or_none()
    if not file:
        raise RecordNotFoundException('File does not exist')
    data = request.get_json()
    user = g.current_user
    user_roles = [role.name for role in user.roles]
    uuids_to_delete = []
    annotation_to_delete = next((ann for ann in file.custom_annotations if ann['uuid'] == data['uuid']), None)
    outcome: Dict[str, str] = {}  # annotation uuid to deletion outcome
    if not annotation_to_delete:
        outcome[data['uuid']] = DeletionOutcome.NOT_FOUND.value
        return jsonify(outcome)
    text = annotation_to_delete['meta']['allText']
    for annotation in file.custom_annotations:
        if (data['deleteAll'] and annotation['meta']['allText'] == text) or annotation['uuid'] == data['uuid']:
            if annotation['user_id'] != user.id and 'admin' not in user_roles:
                outcome[annotation['uuid']] = DeletionOutcome.NOT_OWNER.value
                continue
            uuids_to_delete.append(annotation['uuid'])
            outcome[annotation['uuid']] = DeletionOutcome.DELETED.value
    file.custom_annotations = [ann for ann in file.custom_annotations if ann['uuid'] not in uuids_to_delete]
    db.session.commit()
    return jsonify(outcome)


def annotate(filename, pdf_file_object) -> dict:
    lmdb_dao = get_lmdb_dao()
    pdf_parser = get_annotations_pdf_parser()
    annotator = get_annotations_service(lmdb_dao=lmdb_dao)
    bioc_service = get_bioc_document_service()
    # TODO: Miguel: need to update file_uri with file path
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
        current_app.logger.debug('File deleted: %s, %s', id, file.filename)
        outcome[id] = DeletionOutcome.DELETED.value

    return jsonify(outcome)
