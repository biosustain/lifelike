import attr
from flask import Blueprint
from neo4japp.blueprints.auth import auth
from neo4japp.database import get_search_service_dao, get_neo4j_service_dao
from neo4japp.services.pdf_search import PDFSearch, PDFSearchResult
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


@attr.s(frozen=True)
class PDFSearchRequest(CamelDictMixin):
    query: str = attr.ib()
    offset: int = attr.ib()
    limit: int = attr.ib()


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


# TODO: Added as part of LL-1067, this is a TEMP solution until we design a
# search service consistent with both the visualizer and the drawing tool.
# This will need tests if we decide to maintain it as a standalone service.
@bp.route('/viz-search-temp', methods=['POST'])
@jsonify_with_class(SimpleSearchRequest)
def visualizer_search_temp(req: SimpleSearchRequest):
    search_dao = get_search_service_dao()
    results = search_dao.visualizer_search_temp(req.query, req.page, req.limit, req.filter)
    return SuccessResponse(result=results, status_code=200)


# // TODO: Re-enable once we have a proper predictive/autocomplete implemented
# @bp.route('/search', methods=['POST'])
# @jsonify_with_class(SearchRequest)
# def predictive_search(req: SearchRequest):
#     search_dao = get_search_service_dao()
#     results = search_dao.predictive_search(req.query)
#     return SuccessResponse(result=results, status_code=200)

@bp.route('/pdf-search', methods=['POST'])
@auth.login_required
@jsonify_with_class(PDFSearchRequest)
def search(req: PDFSearchRequest):
    if req.query:
        res = PDFSearch().search(
            user_query=req.query,
            offset=req.offset,
            limit=req.limit,
        )['hits']
    else:
        res = {'hits': [], 'max_score': None, 'total': 0}
    return SuccessResponse(result=res, status_code=200)
