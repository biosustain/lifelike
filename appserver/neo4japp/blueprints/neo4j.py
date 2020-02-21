import attr

from flask import Blueprint

from neo4japp.blueprints import GraphRequest
from neo4japp.constants import *
from neo4japp.database import get_neo4j_service_dao
from neo4japp.util import CamelDictMixin, SuccessResponse, jsonify_with_class

bp = Blueprint('neo4j-api', __name__, url_prefix='/neo4j')


@attr.s(frozen=True)
class ReactionRequest(CamelDictMixin):
    biocyc_id: int = attr.ib()

@attr.s(frozen=True)
class ExpandNodeRequest(CamelDictMixin):
    node_id: int = attr.ib()
    limit: int = attr.ib()

@attr.s(frozen=True)
class AssociationSentencesRequest(CamelDictMixin):
    node_id: int = attr.ib()
    description: str = attr.ib()
    entry_text: str = attr.ib()


@bp.route('/', methods=['POST'])
@jsonify_with_class(GraphRequest)
def load_gpr_graph(req: GraphRequest):
    neo4j = get_neo4j_service_dao()
    graph = neo4j.get_graph(req)
    return SuccessResponse(result=graph, status_code=200)

@bp.route('/organisms', methods=['GET'])
@jsonify_with_class()
def get_organisms():
    neo4j = get_neo4j_service_dao()
    organisms = neo4j.get_organisms()
    return SuccessResponse(result=organisms, status_code=200)

# NOTE: This is just a temp endpoint, may remove in the future
@bp.route('/diseases', methods=['GET'])
@jsonify_with_class()
def get_some_diseases():
    neo4j = get_neo4j_service_dao()
    diseases = neo4j.get_some_diseases()
    return SuccessResponse(result=diseases, status_code=200)

@bp.route('/regulatory', methods=['POST'])
@jsonify_with_class(GraphRequest)
def load_regulatory_graph(req: GraphRequest):
    neo4j = get_neo4j_service_dao()
    if req.is_gene():
        result = neo4j.load_gpr_graph(req)
        return SuccessResponse(result=result, status_code=200)
    return SuccessResponse(result='', status_code=200)

# TODO: Should make sure that the results of expansion are balanced.
# For example, if a node has 1000 Chemical neighbors, but only 1 Gene
@bp.route('/expand', methods=['POST'])
@jsonify_with_class(ExpandNodeRequest)
def expand_graph_node(req: ExpandNodeRequest):
    neo4j = get_neo4j_service_dao()
    node = neo4j.expand_graph(req.node_id, req.limit)
    return SuccessResponse(result=node, status_code=200)

@bp.route('/get-sentences', methods=['POST'])
@jsonify_with_class(AssociationSentencesRequest)
def get_association_sentences(req: AssociationSentencesRequest):
    neo4j = get_neo4j_service_dao()
    sentences = neo4j.get_association_sentences(
        req.node_id,
        req.description,
        req.entry_text
    )
    return SuccessResponse(result=sentences, status_code=200)

@bp.route('/reaction', methods=['POST'])
@jsonify_with_class(ReactionRequest)
def load_reaction_graph(req: ReactionRequest):
    neo4j = get_neo4j_service_dao()
    result = neo4j.load_reaction_graph(req.biocyc_id)
    return SuccessResponse(result=result, status_code=200)
