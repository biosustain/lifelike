import attr
from typing import Dict, List, Optional, Union

from neo4japp.data_transfer_objects.visualization import (
    DuplicateEdgeConnectionData,
    DuplicateVisEdge,
    EdgeConnectionData,
    GetClusterSnippetsResult,
    GetEdgeSnippetsResult,
    GetReferenceTableDataResult,
    GetSnippetsFromEdgeResult,
    ReferenceTablePair,
    ReferenceTableRow,
    Snippet,
    VisEdge,
)
from neo4japp.services.common import GraphBaseDao
from neo4japp.models import GraphNode, GraphRelationship
from neo4japp.constants import *
from neo4japp.factory import cache
from neo4japp.util import (
    CamelDictMixin,
    compute_hash,
    get_first_known_label_from_node,
    snake_to_camel_dict,
)

from py2neo import (
    Graph,
    Node,
    Transaction,
    NodeMatch,
    NodeMatcher,
    Relationship,
    RelationshipMatch,
)


# TODO LL-1143: Extend this into a VisualizerService? But keep what's already here...?
class Neo4JService(GraphBaseDao):
    def __init__(self, graph):
        super().__init__(graph)

    def _neo4j_objs_to_graph_objs(self, nodes: List[Node], relationships: List[Relationship]):
        # TODO: Can possibly use a dispatch method/injection
        # of sorts to use custom labeling methods for
        # different type of nodes/edges being converted.
        # The default does not always set an appropriate label
        # name.
        node_dict = dict()
        rel_dict = dict()

        for node in nodes:
            graph_node = GraphNode.from_py2neo(
                node,
                display_fn=lambda x: x.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(x)]),  # type: ignore  # noqa
                # TODO LL-1143: need to add URL here!
                primary_label_fn=get_first_known_label_from_node,
            )
            node_dict[graph_node.id] = graph_node

        for rel in relationships:
            graph_rel = GraphRelationship.from_py2neo(rel)
            rel_dict[graph_rel.id] = graph_rel
        return dict(nodes=[n.to_dict() for n in node_dict.values()],
                    edges=[r.to_dict() for r in rel_dict.values()])

    # TODO LL-1143: Need to refactor this to use simpler cypher queries, and a lot less python code
    def query_batch(self, data_query: str):
        """ query batch uses a custom query language (one we make up here)
        for returning a list of nodes and their relationships.
        It also works on single nodes with no relationship.

        Example:
            If we wanted all relationships between
            the node pairs (node1, node2) and
            (node3, node4), we will write the
            query as follows:

                node1,node2&node3,node4
        """

        split_data_query = data_query.split('&')

        if len(split_data_query) == 1 and split_data_query[0].find(',') == -1:
            query = """
                MATCH (n) WHERE ID(n)=$node_id RETURN n AS nodeA
            """
            node = self.graph.evaluate(
                query,
                {
                    'node_id': int(split_data_query.pop())
                }
            )
            return self._neo4j_objs_to_graph_objs([node], [])
        else:
            data = [x.split(',') for x in split_data_query]
            query = """
                UNWIND $data as node_pair
                WITH node_pair[0] as from_id, node_pair[1] as to_id
                MATCH (a)-[relationship]->(b)
                WHERE ID(a)=from_id AND ID(b)=to_id
                RETURN
                    apoc.convert.toSet(collect(a) + collect(b)) as nodes,
                    apoc.convert.toSet(collect(relationship)) as relationships
            """
            records = self.graph.run(
                query,
                {
                    'data': data
                }
            ).data()[0]

            return self._neo4j_objs_to_graph_objs(records['nodes'], records['relationships'])

    def get_db_labels(self) -> List[str]:
        """Get all labels from database."""
        labels = self.graph.run('call db.labels()').data()
        return [label['label'] for label in labels]

    def get_db_relationship_types(self) -> List[str]:
        """Get all relationship types from database."""
        relationship_types = self.graph.run('call db.relationshipTypes()').data()
        return [rt['relationshipType'] for rt in relationship_types]

    def get_node_properties(self, node_label) -> Dict[str, List[str]]:
        """Get all properties of a label."""
        props = self.graph.run(f'match (n: {node_label}) unwind keys(n) as key return distinct key').data()  # noqa
        return {node_label: [prop['key'] for prop in props]}

    # TODO LL-1143: Everything beyond this line probably belongs in its own service!
    # They are feature-specific!

    def expand_graph(self, node_id: str, filter_labels: List[str]):
        query = self.get_expand_query()

        result = self.graph.run(
            query,
            {
                'node_id': node_id,
                'labels': filter_labels
            }
        ).data()[0]

        return self._neo4j_objs_to_graph_objs(result['nodes'], result['relationships'])

    def get_snippets_from_edges(
        self,
        from_ids: List[int],
        to_ids: List[int],
        description: str,
        page: int,
        limit: int
    ):
        query = self.get_snippets_from_edges_query()
        return self.graph.run(
            query,
            {
                'from_ids': from_ids,
                'to_ids': to_ids,
                'description': description,  # All the edges should have the same label
                'skip': (page - 1) * limit,
                'limit': limit,
            }
        ).data()

    def get_snippet_count_from_edges(
        self,
        from_ids: List[int],
        to_ids: List[int],
        description: str,
    ):
        query = self.get_snippet_count_from_edges_query()
        return self.graph.run(
            query,
            {
                'from_ids': from_ids,
                'to_ids': to_ids,
                'description': description,  # All the edges should have the same label
            }
        ).evaluate()

    def get_reference_table_data(self, node_edge_pairs: List[ReferenceTablePair]):
        # For duplicate edges, We need to remember which true node ID pairs map to which
        # duplicate node ID pairs, otherwise when we send the data back to the frontend
        # we won't know which duplicate nodes we should match the snippet data with
        ids_to_pairs = {
            (pair.edge.original_from, pair.edge.original_to): pair
            for pair in node_edge_pairs
        }

        # One of these lists will have all duplicates (depends on the direction
        # of the cluster edge). We remove the duplicates so we don't get weird query results.
        from_ids = list({pair.edge.original_from for pair in node_edge_pairs})
        to_ids = list({pair.edge.original_to for pair in node_edge_pairs})
        description = node_edge_pairs[0].edge.label  # Every edge should have the same label

        query = self.get_individual_snippet_count_from_edges_query()
        counts = self.graph.run(
            query,
            {
                'from_ids': from_ids,
                'to_ids': to_ids,
                'description': description,
            }
        ).data()

        reference_table_rows: List[ReferenceTableRow] = []
        for row in counts:
            pair = ids_to_pairs[(row['from_id'], row['to_id'])]
            reference_table_rows.append(ReferenceTableRow(
                node_id=pair.node.id,
                node_display_name=pair.node.display_name,
                node_label=pair.node.label,
                snippet_count=row['count'],
            ))

        return GetReferenceTableDataResult(
            reference_table_rows=reference_table_rows
        )

    def get_snippets_for_edge(
        self,
        edge: EdgeConnectionData,
        page: int,
        limit: int,
    ) -> GetEdgeSnippetsResult:
        from_ids = [edge.from_]
        to_ids = [edge.to]
        description = edge.label  # Every edge should have the same label

        data = self.get_snippets_from_edges(from_ids, to_ids, description, page, limit)
        total_results = self.get_snippet_count_from_edges(from_ids, to_ids, description)

        # `data` is either length 0 or 1
        snippets = []
        for row in data:
            for reference in row['references']:
                snippets.append(
                    Snippet(
                        reference=GraphNode.from_py2neo(
                            reference['snippet'],
                            display_fn=lambda x: x.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(reference['snippet'])]),  # type: ignore  # noqa
                            primary_label_fn=get_first_known_label_from_node,
                        ),
                        publication=GraphNode.from_py2neo(
                            reference['publication'],
                            display_fn=lambda x: x.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(reference['publication'])]),  # type: ignore  # noqa
                            primary_label_fn=get_first_known_label_from_node,
                        ),
                        raw_score=reference['raw_score'],
                        normalized_score=reference['normalized_score']
                    )
                )

        result = GetSnippetsFromEdgeResult(
            from_node_id=edge.from_,
            to_node_id=edge.to,
            association=edge.label,
            snippets=snippets
        )

        return GetEdgeSnippetsResult(
            snippet_data=result,
            total_results=total_results,
            query_data=edge,
        )

    def get_snippets_for_cluster(
        self,
        edges: List[DuplicateEdgeConnectionData],
        page: int,
        limit: int,
    ) -> GetClusterSnippetsResult:
        # For duplicate edges, We need to remember which true node ID pairs map to which
        # duplicate node ID pairs, otherwise when we send the data back to the frontend
        # we won't know which duplicate nodes we should match the snippet data with
        id_pairs = {
            (edge.original_from, edge.original_to): {'from': edge.from_, 'to': edge.to}
            for edge in edges
        }

        # One of these lists will have all duplicates (depends on the direction
        # of the cluster edge). We remove the duplicates so we don't get weird query results.
        from_ids = list({edge.original_from for edge in edges})
        to_ids = list({edge.original_to for edge in edges})
        description = edges[0].label  # Every edge should have the same label

        data = self.get_snippets_from_edges(from_ids, to_ids, description, page, limit)
        total_results = self.get_snippet_count_from_edges(from_ids, to_ids, description)

        results = [
            GetSnippetsFromEdgeResult(
                from_node_id=id_pairs[(row['from_id'], row['to_id'])]['from'],
                to_node_id=id_pairs[(row['from_id'], row['to_id'])]['to'],
                association=row['description'],
                snippets=[Snippet(
                    reference=GraphNode.from_py2neo(
                        reference['snippet'],
                        display_fn=lambda x: x.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(reference['snippet'])]),  # type: ignore  # noqa
                        primary_label_fn=get_first_known_label_from_node,
                    ),
                    publication=GraphNode.from_py2neo(
                        reference['publication'],
                        display_fn=lambda x: x.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(reference['publication'])]),  # type: ignore  # noqa
                        primary_label_fn=get_first_known_label_from_node,
                    ),
                    raw_score=reference['raw_score'],
                    normalized_score=reference['normalized_score']
                ) for reference in row['references']]
            ) for row in data
        ]

        return GetClusterSnippetsResult(
            snippet_data=results,
            total_results=total_results,
            query_data=edges,
        )

    # TODO LL-1143: This should probably go in a different service...
    def get_organisms_from_gene_ids(self, gene_ids: List[str]):
        query = self.get_organisms_from_gene_ids_query()
        result = self.graph.run(
            query, {
                'gene_ids': gene_ids
            }
        ).data()
        return result

    def get_expand_query(self):
        query = """
                MATCH (n)
                WHERE ID(n)=$node_id
                MATCH (n)-[l:ASSOCIATED]-(m)
                WHERE any(x IN $labels WHERE x IN labels(m))
                RETURN
                    apoc.convert.toSet([n] + collect(m)) AS nodes,
                    apoc.convert.toSet(collect(l)) AS relationships
            """
        return query

    def get_snippets_from_edge_query(self, from_label: str, to_label: str):
        query = """
            MATCH (f:{})-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(t:{})
            WHERE ID(f)=$from_id AND ID(t)=$to_id AND a.description=$description
            WITH a AS association
            MATCH (association)<-[:PREDICTS]-(s:Snippet)-[:IN_PUB]-(p:Publication)
            RETURN s AS reference, p AS publication
            ORDER BY p.pub_year DESC
        """.format(from_label, to_label)
        return query

    def get_snippets_from_edges_query(self):
        return """
            MATCH (f)-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(t)
            WHERE
                ID(f) IN $from_ids AND
                ID(t) IN $to_ids AND
                a.description=$description
            WITH
                a AS association,
                ID(f) as from_id,
                ID(t) as to_id,
                a.description as description
            MATCH (association)<-[r:PREDICTS]-(s:Snippet)-[:IN_PUB]-(p:Publication)
            WITH
                COUNT(s) as snippet_count,
                collect({
                    snippet:s,
                    publication:p,
                    raw_score:r.raw_score,
                    normalized_score:r.normalized_score
                }) as references,
                max(p.pub_year) as max_pub_year,
                from_id,
                to_id,
                description
            ORDER BY snippet_count DESC, max_pub_year DESC
            UNWIND references as reference
            WITH
                snippet_count,
                reference,
                from_id,
                to_id,
                description
            ORDER BY snippet_count DESC, coalesce(reference.publication.pub_year, -1) DESC
            SKIP $skip LIMIT $limit
            RETURN collect(reference) as references, from_id, to_id, description
        """

    def get_snippet_count_from_edges_query(self):
        return """
            MATCH (f)-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(t)
            WHERE
                ID(f) IN $from_ids AND
                ID(t) IN $to_ids AND
                a.description=$description
            WITH
                a AS association,
                ID(f) as from_id,
                ID(t) as to_id
            MATCH (association)<-[:PREDICTS]-(s:Snippet)-[:IN_PUB]-(p:Publication)
            RETURN COUNT(s) as snippet_count
        """

    def get_individual_snippet_count_from_edges_query(self):
        query = """
            MATCH (f)-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(t)
            WHERE
                ID(f) IN $from_ids AND
                ID(t) IN $to_ids AND
                a.description=$description
            WITH
                a as association,
                ID(f) as from_id,
                ID(t) as to_id,
                labels(f) as from_labels,
                labels(t) as to_labels
            OPTIONAL MATCH (association)<-[:PREDICTS]-(s:Snippet)-[:IN_PUB]-(p:Publication)
            WITH
                COUNT(s) as snippet_count,
                collect({
                    snippet:s,
                    publication:p
                }) as references,
                max(p.pub_year) as max_pub_year,
                from_id,
                to_id,
                from_labels,
                to_labels
            ORDER BY snippet_count DESC, coalesce(max_pub_year, -1) DESC
            RETURN from_id, to_id, from_labels, to_labels, snippet_count as count
        """
        return query

    def get_organisms_from_gene_ids_query(self):
        """Retrieves a list of gene and corresponding organism data
        from a given list of genes."""
        query = """
            MATCH (g:Gene) WHERE g.id IN $gene_ids
            WITH g
            MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)
            RETURN g.id AS gene_id, g.name as gene_name, t.id as taxonomy_id, t.name as species_name
        """
        return query
