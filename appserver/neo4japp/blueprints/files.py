from enum import Enum
import io
import uuid
from datetime import datetime
import os
import json
from typing import Dict
from neo4japp.blueprints.auth import auth
from flask import Blueprint, current_app, request, abort, jsonify, g, make_response
from werkzeug.exceptions import Forbidden
from werkzeug.utils import secure_filename

from neo4japp.blueprints.auth import auth
from neo4japp.database import (
    db,
    get_annotations_service,
    get_annotations_pdf_parser,
    get_bioc_document_service,
)
from neo4japp.exceptions import RecordNotFoundException, BadRequestError
from neo4japp.models.files import Files

bp = Blueprint('files', __name__, url_prefix='/files')


@bp.route('/upload', methods=['POST'])
@auth.login_required
def upload_pdf():
    pdf = request.files['file']
    project = '1'  # TODO: remove hard coded project
    binary_pdf = pdf.read()
    username = g.current_user

    filename = secure_filename(request.files['file'].filename)
    # Make sure that the filename is not longer than the DB column permits
    max_filename_length = Files.filename.property.columns[0].type.length
    if len(filename) > max_filename_length:
        name, extension = os.path.splitext(filename)
        if len(extension) > max_filename_length:
            extension = ".dat"
        filename = name[:max(0, max_filename_length - len(extension))] + extension
    file_id = str(uuid.uuid4())

    annotations = annotate(filename, pdf)

    files = Files(
        file_id=file_id,
        filename=filename,
        raw_file=binary_pdf,
        username=username.id,
        annotations=annotations,
        project=project
    )

    db.session.add(files)
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
        Files.username,
        Files.creation_date)
        .filter(Files.project == project)
        .all()]
    return jsonify({'files': files})


@bp.route('/<id>', methods=['GET', 'DELETE'])
@auth.login_required
def get_or_delete_file(id):
    entry = db.session.query(Files).filter(Files.file_id == id).one()
    if request.method == 'GET':
        res = make_response(entry.raw_file)
        res.headers['Content-Type'] = 'application/pdf'
        return res
    if request.method == 'DELETE':
        if g.current_user.id != int(entry.username):
            current_app.logger.error('Cannot delete file (not an owner): %s, %s', entry.file_id, entry.filename)
            raise Forbidden(
                description='You are not the owner of this file. You cannot delete it.'
            )
        db.session.delete(entry)
        db.session.commit()
        return ''


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
    file = Files.query.filter_by(file_id=id).one_or_none()
    if not file:
        raise RecordNotFoundException('File does not exist')
    file.custom_annotations = [annotation_to_add, *file.custom_annotations]
    db.session.commit()
    return {'status': 'success'}, 200


def annotate(filename, pdf_file_object) -> dict:
    pdf_parser = get_annotations_pdf_parser()
    annotator = get_annotations_service()
    bioc_service = get_bioc_document_service()
    # TODO: Miguel: need to update file_uri with file path
    parsed_pdf_chars = pdf_parser.parse_pdf(pdf=pdf_file_object)
    tokens = pdf_parser.extract_tokens(parsed_chars=parsed_pdf_chars)
    annotations = annotator.create_annotations(tokens=tokens)
    pdf_text = pdf_parser.parse_pdf_high_level(pdf=pdf_file_object)
    bioc = bioc_service.read(text=pdf_text, file_uri=filename)
    return bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)


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
        file = Files.query.filter_by(file_id=id).one_or_none()
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
            file.annotations = annotations
            db.session.commit()
            current_app.logger.debug('File successfully annotated: %s, %s', id, file.filename)
            outcome[id] = AnnotationOutcome.ANNOTATED.value
        fp.close()
    return jsonify(outcome)


class DeletionOutcome(Enum):
    DELETED = 'Deleted'
    NOT_DELETED = 'Not deleted'
    NOT_FOUND = 'Not found'


@bp.route('/bulk_delete', methods=['POST'])
@auth.login_required
def delete_files():
    ids = request.get_json()
    outcome: Dict[str, str] = {}  # file id to deletion outcome
    for id in ids:
        file = Files.query.filter_by(file_id=id).one_or_none()
        if file is None:
            current_app.logger.error('Could not find file: %s, %s', id, file.filename)
            outcome[id] = DeletionOutcome.NOT_FOUND.value
            continue
        if g.current_user.id != int(file.username):
            current_app.logger.error('Cannot delete file (not an owner): %s, %s', id, file.filename)
            outcome[id] = DeletionOutcome.NOT_DELETED.value
            continue
        db.session.delete(file)
        db.session.commit()
        current_app.logger.debug('File deleted: %s, %s', id, file.filename)
        outcome[id] = DeletionOutcome.DELETED.value
    return jsonify(outcome)
