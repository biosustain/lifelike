from flask import Blueprint, request

from neo4japp.constants import DOMAIN_URLS_MAP
from neo4japp.models import AnnotationStyle

bp = Blueprint('entity-resources', __name__, url_prefix='/entity-resources')


@bp.route('/style/<string:annotation_label>', methods=['GET'])
def get_style(annotation_label):
    style = AnnotationStyle.query.filter_by(label=annotation_label)[0]
    return style.get_as_json()


@bp.route('/style', methods=['GET'])
def get_all_styles():
    return {'styles': [x.get_as_json() for x in AnnotationStyle.query.all()]}


@bp.route('/uri', methods=['POST'])
def get_uri():
    """
    POST body:
    {
        domain: string representing the domain name
        term: string or number referring to be used on composing the URI for the element
    }
    :return:
    {
        uri: string with the URI for the resource
    }
    """
    payload = request.json

    uri = DOMAIN_URLS_MAP[payload['domain']]
    return {'uri': uri.format(payload['term'])}


@bp.route('/uri/batch', methods=['POST'])
def get_uri_batch():
    """
        POST body:
        {   batch: list of items to get the corresponfing URI
            [
                {
                    domain: string representing the domain name
                    term: string or number referring to be used on composing the URI for the element
                }
            ]
        }
        :return:
        {
            batch: list of uris for the given item
            [
                {
                    uri: string with the URI for the resource
                }
            ]
        }
        """
    uris = []
    payload = request.json
    for entry in payload['batch']:
        uri = DOMAIN_URLS_MAP[entry['domain']]
        uris.append({'uri': uri.base_URL.format(entry['term'])})

    return {'batch': uris}
