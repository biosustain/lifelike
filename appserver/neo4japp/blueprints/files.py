import io
import uuid
from datetime import datetime
import os
import json
from typing import List
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

    annotations = annotate(file_id, filename, pdf)

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
    # data = request.get_json()
    # project = data['project']
    project = '1'  # TODO: remove hard coded project

    annotations = db.session.query(Files.annotations)\
        .filter(Files.file_id == id and Files.project == project)\
        .one()

    # TODO: Should remove this eventually...the annotator should return data readable by the
    # lib-pdf-viewer-lib, or the lib should conform to what is being returned by the annotator.
    # Something has to give.
    def map_annotations_to_correct_format(unformatted_annotations: dict):
        unformatted_annotations_list = unformatted_annotations[0]['documents'][0]['passages'][0]['annotations']  # noqa
        formatted_annotations_list = []

        for unformatted_annotation in unformatted_annotations_list:
            # Remove the 'keywordType' attribute and replace it with 'type', as the
            # lib-pdf-viewer-lib does not recognize 'keywordType'
            keyword_type = unformatted_annotation['meta']['keywordType']
            del unformatted_annotation['meta']['keywordType']
            unformatted_annotation['meta']['type'] = keyword_type

            formatted_annotations_list.append(unformatted_annotation)
        return formatted_annotations_list

    return jsonify(map_annotations_to_correct_format(annotations))


def write_file(data, filename):
    # Convert binary data to proper format and write it on Hard Disk
    with open(filename, 'wb') as f:
        f.write(data)


def annotate(file_id, filename, pdf_file_object) -> dict:
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


@bp.route('/reannotate', methods=['POST'])
@auth.login_required
def reannotate():
    ids = request.get_json()
    succeeded: List[str] = []
    for id in ids:
        file = Files.query.filter_by(file_id=id).first()
        fp = io.BytesIO(file.raw_file)
        try:
            annotations = annotate(id, file.filename, fp)
        except Exception:
            pass
        else:
            file.annotations = annotations
            db.session.commit()
            succeeded.append(id)
        fp.close()
    return jsonify(succeeded)
