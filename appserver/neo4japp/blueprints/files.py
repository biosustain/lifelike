import uuid
from datetime import datetime
import os
import json
from neo4japp.blueprints.auth import auth
from flask import Blueprint, request, abort, jsonify, g, make_response
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
    annotator = get_annotations_service()
    bioc_service = get_bioc_document_service()
    pdf_parser = get_annotations_pdf_parser()

    pdf = request.files['file']
    project = '1'  # TODO: remove hard coded project
    binary_pdf = pdf.read()
    username = g.current_user

    filename = secure_filename(request.files['file'].filename)
    file_id = str(uuid.uuid4())

    try:
        parsed_pdf_chars = pdf_parser.parse_pdf(pdf=pdf)
        pdf_text = pdf_parser.parse_pdf_high_level(pdf=pdf)
        annotations = annotator.create_annotations(
            tokens=pdf_parser.extract_tokens(parsed_chars=parsed_pdf_chars))

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
            project=project
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
    entry = db.session.query(Files.raw_file).filter(Files.file_id == id).one()
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
