from flask import Blueprint

from neo4japp.blueprints.auth import auth
from neo4japp.models import AnnotationStyle, DomainULRsMap

bp = Blueprint('annotations', __name__, url_prefix='/annotations')


@bp.route('/style', methods=['GET'])
@auth.login_required
def get_style(annotation):
    style = AnnotationStyle.query.filter_by(label=annotation)
    return style.get_as_json()


@bp.route('/styles', methods=['GET'])
@auth.login_required
def get_all_styles(): #TODO
    pass


@bp.route('/uri', methods=['GET'])
@auth.login_required
def get_uri(identifier, domain):
    uri = DomainULRsMap.query.filter_by(domain=domain)
    return {'uri': uri.base_URL + identifier}


@bp.route('/uri', methods=['GET'])
@auth.login_required
def get_uri_batch(params): #TODO
    pass
