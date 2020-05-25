import attr

from flask import Blueprint

from neo4japp.database import get_search_service_dao, get_neo4j_service_dao
from neo4japp.util import CamelDictMixin, jsonify_with_class, SuccessResponse

bp = Blueprint('search', __name__, url_prefix='/search')


@attr.s(frozen=True)
class SearchRequest(CamelDictMixin):
    query: str = attr.ib()
    page: int = attr.ib()
    limit: int = attr.ib()


@attr.s(frozen=True)
class SimpleSearchRequest(CamelDictMixin):
    query: str = attr.ib()
    page: int = attr.ib()
    limit: int = attr.ib()
    filter: str = attr.ib()


@bp.route('/search', methods=['POST'])
@jsonify_with_class(SearchRequest)
def fulltext_search(req: SearchRequest):
    search_dao = get_search_service_dao()
    results = search_dao.fulltext_search(req.query, req.page, req.limit)
    return SuccessResponse(result=results, status_code=200)


@bp.route('/simple-search', methods=['POST'])
@jsonify_with_class(SimpleSearchRequest)
def simple_full_text_search(req: SimpleSearchRequest):
    search_dao = get_search_service_dao()
    results = search_dao.simple_text_search(req.query, req.page, req.limit, req.filter)
    return SuccessResponse(result=results, status_code=200)

# // TODO: Re-enable once we have a proper predictive/autocomplete implemented
# @bp.route('/search', methods=['POST'])
# @jsonify_with_class(SearchRequest)
# def predictive_search(req: SearchRequest):
#     search_dao = get_search_service_dao()
#     results = search_dao.predictive_search(req.query)
#     return SuccessResponse(result=results, status_code=200)
