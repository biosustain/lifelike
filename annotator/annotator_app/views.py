from flask import request

from ..app import app
from .services.annotations.annotation_service import annotate_file


@app.route('/health', methods=['GET'])
def health():
    return "I am OK!"


@app.route('/annotate-file', methods=['GET'])
def annotate():
    data = request.get_json()
    return annotate_file(
        user_id=data['user_id'],
        file_id=data['file_id'],
        global_exclusions=data['global_exclusions'],
        local_exclusions=data['local_exclusions'],
        local_inclusions=data['local_inclusions'],
        organism_synonym=data['organism_synonym'],
        organism_taxonomy_id=data['organism_taxonomy_id'],
        annotation_configs=data['annotation_configs']
    ), dict(mimetype='application/json')
