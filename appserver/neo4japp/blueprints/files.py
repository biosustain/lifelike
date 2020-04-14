import uuid
from datetime import datetime
import os
import json
from neo4japp.blueprints.auth import auth
from flask import Blueprint, request, abort, send_from_directory, jsonify, g
from werkzeug.utils import secure_filename

from neo4japp.database import (
    db,
    get_annotations_service,
    get_bioc_document_service,
    get_token_extractor_service,
)
from neo4japp.models.files import Files

bp = Blueprint('files', __name__, url_prefix='/files')

ALLOWED_EXTENSIONS = {'pdf'}
UPLOAD_FOLDER = 'files/input/'
OUTPUT_PATH = 'files/output/'


@bp.route('/upload', methods=['POST'])
@auth.login_required
def upload_pdf():
    annotator = get_annotations_service()
    bioc_service = get_bioc_document_service()
    token_extractor = get_token_extractor_service()
    pdf = request.files['file']
    binary_pdf = pdf.read()
    username = g.current_user
    filename = secure_filename(request.files['file'].filename)
    file_id = str(uuid.uuid4())

    try:
        pdf_text = token_extractor.parse_pdf(pdf=pdf)
        annotations = annotator.create_annotations(
            tokens=token_extractor.extract_tokens(text=pdf_text))

        # TODO: Miguel: need to update file_uri with file path
        bioc = bioc_service.read(text=pdf_text, file_uri=filename)
        annotations_json = bioc_service.generate_bioc_json(
            annotations=annotations, bioc=bioc)

        files = Files(
            file_id=file_id,
            filename=filename,
            raw_file=binary_pdf,
            username=username.id,
            annotations=annotations_json,
        )
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
    files = [{
        'id': row.id,
        'file_id': row.file_id,
        'filename': row.filename,
        'username': row.username,
        'creation_date': row.creation_date,
    } for row in db.session.query(
        Files.id,
        Files.file_id,
        Files.filename,
        Files.username,
        Files.creation_date).all()]
    return jsonify({'files': files})


@bp.route('/get_pdf/<id>', methods=['GET'])
@auth.login_required
def get_pdf(id):
    OUTPUT_PATH = os.path.abspath(os.getcwd()) + '/outputs/'
    file, filename = db.session.query(Files.raw_file,
                                      Files.filename)\
        .filter(Files.file_id == id).one()
    file_full_path = OUTPUT_PATH + filename
    # TODO: Remove writing in filesystem part, this is not needed should be tackle in next version
    write_file(file, file_full_path)
    return send_from_directory(OUTPUT_PATH, filename)


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
    annotations = db.session.query(Files.annotations).filter(Files.file_id == id).one()
    return jsonify(annotations)


def write_file(data, filename):
    # Convert binary data to proper format and write it on Hard Disk
    with open(filename, 'wb') as f:
        f.write(data)
