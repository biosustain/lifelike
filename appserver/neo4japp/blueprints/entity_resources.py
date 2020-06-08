from flask import Blueprint

from appserver.neo4japp.blueprints import auth
from appserver.neo4japp.models import AnnotationStyle, DomainULRsMap

bp = Blueprint('files', __name__, url_prefix='/files')


@bp.route('/upload', methods=['GET'])
@auth.login_required
def get_style(annotation):
    style = AnnotationStyle.query.filter_by(label=annotation)
    return style.get_as_json()


@bp.route('/upload', methods=['GET'])
@auth.login_required
def get_uri(identifier, domain):
    uri = DomainULRsMap.query.filter_by(domain=domain)
    return {'uri': uri.base_URL + identifier}
