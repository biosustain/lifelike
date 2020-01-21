import attr
from flask import Blueprint
from neo4japp.services.aws_elasticsearch import EsSearch
from neo4japp.util import jsonify_with_class, SuccessResponse

bp = Blueprint('elasticsearch', __name__, url_prefix='/search')

@bp.route('/<term>')
@jsonify_with_class()
def es_search(term):
    es = EsSearch()
    res = es.search(term)
    return SuccessResponse(result=res, status_code=200)
