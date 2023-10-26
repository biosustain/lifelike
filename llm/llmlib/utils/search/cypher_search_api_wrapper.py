from typing import List, Any, Dict, TypedDict

import yaml
from langchain.schema import Document
from llmlib.utils.lazy_neo4j_graph import LazyNeo4jGraph
from llmlib.utils.search.graph_search_api_wrapper import GraphSearchAPIWrapper
from math import floor

CURRENCY_METABOLITES = [
    'NAD-P-OR-NOP', 'NADH-P-OR-NOP', 'Donor-H2', 'Acceptor', 'HYDROGEN-PEROXIDE', 'OXYGEN-MOLECULE',
    'NAD', 'NADP', 'NADH', 'NADPH', 'WATER', 'CARBON-DIOXIDE', 'FAD', 'CO-A', 'UDP', 'AMMONIA',
    'NA+',
    'AMMONIUM', 'PROTON', 'CARBON-MONOXIDE', 'GTP', 'ADP', 'GDP', 'AMP', 'ATP', '3-5-ADP', 'PPI',
    'Pi'
]

RANKED_RELATED_NODES_MAPPING_QUERY = """
UNWIND $terms AS term
MATCH (s:Synonym {lowercase_name: toLower(term)})<-[:HAS_SYNONYM]-(n)
WHERE n.eid IS NOT NULL AND NOT n.eid IN $exclude_eids
WITH apoc.text.levenshteinSimilarity(term, n.name) as similarity, s, n, term
ORDER BY similarity DESC
WHERE similarity > 0.5
WITH DISTINCT term, collect({node: n, node_id: id(n), similarity: similarity})[0..$top_k_matches] as matches
RETURN term, matches
"""

RELATED_SHORTEST_PATH_QUERY = """
UNWIND apoc.coll.combinations($term_match, 2) AS termPair
UNWIND termPair[0]['matches'] as matchA
UNWIND termPair[1]['matches'] as matchB
WITH matchA, matchB, matchA['similarity'] * matchB['similarity'] AS similarity
ORDER BY similarity DESC
WHERE similarity > 0.5
MATCH (a), (b)
WHERE id(a) = matchA['id'] AND id(b) = matchB['id']
MATCH path=allShortestPaths((a)-[*1..]-(b))
WHERE
 all(r in relationships(path) where type(r) in $include_rels)
 and all(n in nodes(path) where not n.eid in $exclude_eids)
RETURN path LIMIT $top_k
"""


class Node(TypedDict):
    eid: str


class NodeMatch(TypedDict):
    node: Node
    node_id: int
    similarity: float


class TermMatches(TypedDict):
    term: str
    matches: List[NodeMatch]


def preformat_entity(entity):
    return {
        k: v
        for k, v in entity.items()
        if v and (
            k not in (
                'genes', 'inchi', 'inchi_key', 'original_entity_types', 'left_end_position',
                'right_end_position',
            )
        )
    }


def term_match_template(obj):
    return yaml.dump(
        {
            obj['term']: [
                {
                    'matches': [
                        preformat_entity(match['node'])
                        for match in obj['matches']
                    ]
                }
            ]
        }
    )


def relationship_template(obj):
    return yaml.dump(
        {
            'relationship': {
                'path': ' - '.join(
                    map(
                        lambda n: n.get('eid', '') if isinstance(n, dict) else n,
                        obj['path'],
                    )
                ),
                'segments': [
                    (preformat_entity(n) if isinstance(n, dict) else n)
                    for n in obj['path']
                ]
            }
        }
    )


class CypherSearchAPIWrapper(GraphSearchAPIWrapper):
    graph: LazyNeo4jGraph

    class Config:
        arbitrary_types_allowed = True

    related_nodes_query: str = RANKED_RELATED_NODES_MAPPING_QUERY
    related_nodes_query_params: Dict[str, Any] = dict(
        top_k_matches=5,
        exclude_eids=CURRENCY_METABOLITES,
    )
    relationships_query: str = RELATED_SHORTEST_PATH_QUERY
    relationships_query_params: Dict[str, Any] = dict(
        top_k=3,
        include_rels=['CONSUMED_BY', 'PRODUCES', 'CATALYZES', 'REGULATES', 'HAS_TXONOMY', 'IS',
                      'HAS_KO', 'ELEMENT_OF', 'ENCODES'],
        exclude_eids=CURRENCY_METABOLITES,
    )

    def node_to_document(self, term_match: TermMatches) -> Document:
        return Document(
            page_content=term_match_template(term_match),
            metadata=dict(
                term=term_match['term'],
            ),
        )

    def relationship_to_document(self, relationship: dict) -> Document:
        path_len = len(relationship['path'])
        return Document(
            page_content=relationship_template(relationship),
            metadata=dict(
                start_eid=relationship['path'][0]['eid'],
                end_eid=relationship['path'][path_len - 1]['eid'],
                distance=floor(path_len / 2)
            ),
        )

    def get_related_nodes(self, terms: List[str]) -> List[TermMatches]:
        mapping = self.graph.query(
            self.related_nodes_query,
            dict(**self.related_nodes_query_params, terms=terms),
        )
        assert len(mapping) <= len(terms)
        return mapping

    def get_relationships(self, term_match: List[TermMatches]) -> List[dict]:
        term_match_id = [
            {
                'term': term_match['term'],
                'matches': [
                    {
                        'id': match['node_id'],
                        'similarity': match['similarity'],
                    }
                    for match in term_match['matches']
                ],
            }
            for term_match in term_match
        ]

        return self.graph.query(
            self.relationships_query,
            dict(**self.relationships_query_params, term_match=term_match_id),
        )
