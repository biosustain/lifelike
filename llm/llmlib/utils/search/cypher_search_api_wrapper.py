from typing import List, Any, Dict, TypedDict

import yaml
from langchain.schema import Document
from llmlib.utils.lazy_neo4j_graph import LazyNeo4jGraph
from llmlib.utils.search.graph_search_api_wrapper import GraphSearchAPIWrapper

RANKED_RELATED_NODES_MAPPING_QUERY = """
UNWIND $terms AS term
MATCH (s:Synonym {lowercase_name: toLower(term)})<-[:HAS_SYNONYM]-(n)
WHERE n.eid IS NOT NULL
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
MATCH path=shortestPath((a)-[:CONSUMED_BY|PRODUCES|CATALYZES|REGULATES|HAS_TXONOMY|IS|HAS_KO|ENCODES|GO_LINK*1..20]-(b))
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


def term_match_template(obj):
    return yaml.dump(
        {
            obj['term']: [
                {
                    'matches': [
                        {
                            'eid': match['node']['eid'],
                            'name': match['node']['name'],
                            'similarity': match['similarity'],
                        }
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
                'nodes': {
                    node['eid']: {
                        'name': node.get('displayName'),
                        'type': node.get('entityType', node.get('type')),
                        'description': node.get('description'),
                    }
                    for node in list(
                        filter(
                            lambda n: isinstance(n, dict) and n.get('eid'), obj['path']
                        )
                    )
                },
            }
        }
    )


class CypherSearchAPIWrapper(GraphSearchAPIWrapper):
    graph: LazyNeo4jGraph

    class Config:
        arbitrary_types_allowed = True

    related_nodes_query: str = RANKED_RELATED_NODES_MAPPING_QUERY
    related_nodes_query_params: Dict[str, Any] = dict(top_k_matches=10)
    relationships_query: str = RELATED_SHORTEST_PATH_QUERY
    relationships_query_params: Dict[str, Any] = dict(top_k=1)

    def node_to_document(self, term_match: TermMatches) -> Document:
        return Document(
            page_content=term_match_template(term_match),
            metadata=dict(
                term=term_match['term'],
            ),
        )

    def relationship_to_document(self, relationship: dict) -> Document:
        return Document(
            page_content=relationship_template(relationship),
            metadata=dict(
                start_eid=relationship['path'][0]['eid'],
                end_eid=relationship['path'][len(relationship) - 1]['eid'],
                distance=len(relationship['path']),
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
