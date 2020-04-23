import io
import uuid
from datetime import datetime
import os
import json
from typing import Optional
from neo4japp.blueprints.auth import auth
from flask import Blueprint, request, abort, send_from_directory, jsonify, g
from werkzeug.utils import secure_filename

from neo4japp.database import (
    db,
    get_annotations_service,
    get_annotations_pdf_parser,
    get_bioc_document_service,
)
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
    file_id = str(uuid.uuid4())

    annotations_json = annotate(file_id, filename, pdf)

    if annotations_json is None:
        abort(400, 'Could not annotate file')

    files = Files(
        file_id=file_id,
        filename=filename,
        raw_file=binary_pdf,
        username=username.id,
        annotations=annotations_json,
        project=project
    )

    try:
        db.session.add(files)
        db.session.commit()
        return jsonify({
            'file_id': file_id,
            'filename': filename,
            'status': 'Successfully uploaded'
        })
    except Exception:
        return abort(
            400,
            'File was unable to upload, please try again and make sure the file is a PDF.'
        )


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


@bp.route('/<id>', methods=['GET'])
@auth.login_required
def get_pdf(id):
    project = '1'  # TODO: remove hard coded project
    file, filename = db.session.query(Files.raw_file, Files.filename) \
        .filter(Files.file_id == id and Files.project == project)\
        .one()
    # TODO: Remove writing in filesystem part, this is not needed should be tackle in next version
    outdir = os.path.abspath(os.getcwd())
    write_file(file, os.path.join(outdir, filename))
    return send_from_directory(outdir, filename)


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
    data = request.get_json()
    annotations = db.session.query(Files.annotations)\
        .filter(Files.file_id == id and Files.project == data['project'])\
        .one()
    return jsonify(annotations)


def write_file(data, filename):
    # Convert binary data to proper format and write it on Hard Disk
    with open(filename, 'wb') as f:
        f.write(data)


def annotate(file_id, filename, pdf_file_object) -> Optional[str]:
    pdf_parser = get_annotations_pdf_parser()
    annotator = get_annotations_service()
    bioc_service = get_bioc_document_service()
    annotations_json = None
    try:
        # TODO: Miguel: need to update file_uri with file path
        parsed_pdf_chars = pdf_parser.parse_pdf(pdf=pdf_file_object)
        tokens = pdf_parser.extract_tokens(parsed_chars=parsed_pdf_chars)
        annotations = annotator.create_annotations(tokens=tokens)
        pdf_text = pdf_parser.parse_pdf_high_level(pdf=pdf_file_object)
        bioc = bioc_service.read(text=pdf_text, file_uri=filename)
        annotations_json = bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)
    except Exception:
        pass
    return annotations_json


@bp.route('/<id>/reannotate')
@auth.login_required
def reannotate(id):
    file = Files.query.filter_by(file_id=id).first()
    fp = io.BytesIO(file.raw_file)
    annotations_json = annotate(id, file.filename, fp)
    fp.close()
    if annotations_json is None:
        abort(400, 'Could not annotate file')
    file.annotations = annotations_json
    db.session.commit()
    return jsonify(annotations_json)
