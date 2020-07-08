from flask import Blueprint, request

from neo4japp.blueprints.auth import auth
from neo4japp.models import AnnotationStyle, DomainULRsMap

bp = Blueprint('annotations', __name__, url_prefix='/annotations')


@bp.route('/style/<string:annotation>', methods=['GET'])
@auth.login_required
def get_style(annotation):
    style = AnnotationStyle.query.filter_by(label=annotation)[0]
    return style.get_as_json()


@bp.route('/style', methods=['GET'])
@auth.login_required
def get_all_styles():
    return {'styles': [x.get_as_json() for x in AnnotationStyle.query.all()]}


@bp.route('/uri', methods=['POST'])
@auth.login_required
def get_uri():
    payload = request.json

    uri = DomainULRsMap.query.filter_by(domain=payload['domain'])[0]
    return {'uri': uri.base_URL + payload['identifier']}


@bp.route('/uri/batch', methods=['POST'])
@auth.login_required
def get_uri_batch():
    uris = []
    payload = request.json
    for entry in payload['batch']:
        uri = DomainULRsMap.query.filter_by(domain=entry['domain'])[0]
        uris.append({'uri': uri.base_URL + entry['identifier']})

    return {'batch': uris}
