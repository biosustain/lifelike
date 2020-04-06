from flask import Blueprint, request, abort, send_from_directory
from neo4japp.models.files import Files
from werkzeug.utils import secure_filename
import uuid
from datetime import datetime
from neo4japp.database import db
from flask import jsonify
import os
import json
from neo4japp.blueprints.auth import auth

bp = Blueprint('files', __name__, url_prefix='/files')
ALLOWED_EXTENSIONS = {'pdf'}
UPLOAD_FOLDER = 'files/input/'
OUTPUT_PATH = 'files/output/'


@bp.route('/upload', methods=['POST'])
@auth.login_required
def upload_pdf():
    pdf = request.files['file'].read()
    username = request.form['user']
    filename = secure_filename(request.files['file'].filename)
    file_id = str(uuid.uuid4())
    try:
        data = Files(file_id, filename, pdf, username, [])
        db.session.add(data)
        db.session.commit()
        return jsonify({
            'id': file_id,
            'filename': filename,
            'status': 'Successfully uploaded'
        })
    except:
        return abort(400, 'File was unable to upload, please try again and make sure the file is a PDF.')


@bp.route('/list', methods=['GET'])
@auth.login_required
def list_files():
    files = [{
        'id': row.id,
        'file_id': row.file_id,
        'filename': row.filename,
        'username': row.username,
        'creation_date': row.creation_date,
    } for row in db.session.query(Files.id, Files.file_id, Files.filename, Files.username, Files.creation_date).all()]
    return jsonify({'files': files})


@bp.route('/get_pdf/<id>', methods=['GET'])
@auth.login_required
def get_pdf(id):
    OUTPUT_PATH = os.path.abspath(os.getcwd()) + '/outputs/'
    file, filename = db.session.query(Files.raw_file, Files.filename).filter(Files.file_id == id).one()
    file_full_path = OUTPUT_PATH + filename
    #TODO: Remove writing in filesystem part, this is not needed should be tackle in next version
    write_file(file, file_full_path)
    return send_from_directory(OUTPUT_PATH, filename)


@bp.route('/bioc', methods=['GET'])
def transform_to_bioc():
    TEMPLATE_PATH = os.path.abspath(os.getcwd()) + '/templates/bioc.json'
    with open(TEMPLATE_PATH , 'r') as file:
        data = request.get_json()
        current_time = datetime.now()
        template = json.load(file)
        template['date'] = current_time.strftime('%Y-%m-%d')
        template['id'] = data['id']
        template['documents'][0]['passages'][0]['text'] = data['text']
        template['documents'][0]['passages'][0]['annotations'] = data['annotations']
        return jsonify(template)


def write_file(data, filename):
    # Convert binary data to proper format and write it on Hard Disk
    with open(filename, 'wb') as file:
        file.write(data)