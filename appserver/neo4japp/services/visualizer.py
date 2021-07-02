from neo4j import Record as Neo4jRecord, Transaction as Neo4jTx
from typing import List

from neo4japp.data_transfer_objects.visualization import (
    Direction,
    DuplicateEdgeConnectionData,
    EdgeConnectionData,
    GetClusterSnippetsResult,
    GetEdgeSnippetsResult,
    GetNodePairSnippetsResult,
    GetReferenceTableDataResult,
    GetSnippetsFromEdgeResult,
    ReferenceTablePair,
    ReferenceTableRow,
    Snippet,
    GetAssociatedTypesResult,
)
from neo4japp.models import GraphNode
from neo4japp.services import KgService
from neo4japp.util import (
    snake_to_camel_dict
)


class VisualizerService(KgService):
    def __init__(self, graph, session):
        super().__init__(graph=graph, session=session)

    def expand_graph(self, node_id: str, filter_labels: List[str]):
        result = self.graph.read_transaction(self.get_expand_query, node_id, filter_labels)

        nodes = []
        relationships = []
        if len(result) > 0:
            nodes = result[0]['nodes']
            relationships = result[0]['relationships']

        return self._neo4j_objs_to_graph_objs(nodes, relationships)

    def get_snippets_from_edges(
        self,
        from_ids: List[int],
        to_ids: List[int],
        description: str,
        page: int,
        limit: int
    ):
        return self.graph.read_transaction(
            self.get_snippets_from_edges_query,
            from_ids,
            to_ids,
            description,
            (page - 1) * limit,
            limit
        )

    def get_snippets_from_node_pair(
        self,
        from_id: int,
        to_id: int,
        page: int,
        limit: int
    ):
        return self.graph.read_transaction(
            self.get_snippets_from_node_pair_query,
            from_id,
            to_id,
            (page - 1) * limit,
            limit
        )

    def get_snippet_count_from_edges(
        self,
        from_ids: List[int],
        to_ids: List[int],
        description: str,
    ):
        return self.graph.read_transaction(
            self.get_snippet_count_from_edges_query,
            from_ids,
            to_ids,
            description
        )['snippet_count']

    def get_snippet_count_from_node_pair(
        self,
        from_id: int,
        to_id: int,
    ):
        return self.graph.read_transaction(
            self.get_snippet_count_from_node_pair_query,
            from_id,
            to_id
        )['snippet_count']

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
        direction = Direction.FROM.value if len(from_ids) == 1 else Direction.TO.value

        counts = self.graph.read_transaction(
            self.get_individual_snippet_count_from_edges_query,
            from_ids,
            to_ids,
            description
        )

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
            reference_table_rows=reference_table_rows,
            direction=direction
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
                        reference=GraphNode(
                            reference['snippet']['id'],
                            'Snippet',
                            [],
                            snake_to_camel_dict(reference['snippet']['data'], {}),
                            [],
                            None,
                            None,
                        ),
                        publication=GraphNode(
                            reference['publication']['id'],
                            'Publication',
                            [],
                            snake_to_camel_dict(reference['publication']['data'], {}),
                            [],
                            None,
                            None,
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
                    reference=GraphNode(
                        reference['snippet']['id'],
                        'Snippet',
                        [],
                        snake_to_camel_dict(reference['snippet']['data'], {}),
                        [],
                        None,
                        None,
                    ),
                    publication=GraphNode(
                        reference['publication']['id'],
                        'Publication',
                        [],
                        snake_to_camel_dict(reference['publication']['data'], {}),
                        [],
                        None,
                        None,
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

    def get_associated_type_snippet_count(
        self,
        source_node: int,
        associated_nodes: List[int],
        label: str
    ):
        sanitized_label = ''
        if (label == 'Gene'):
            sanitized_label = 'Gene'
        elif (label == 'Chemical'):
            sanitized_label = 'Chemical'
        elif (label == 'Disease'):
            sanitized_label = 'Disease'

        results = self.graph.read_transaction(
            self.get_associated_type_snippet_count_query,
            sanitized_label,
            source_node,
            associated_nodes
        )

        return GetAssociatedTypesResult(
            associated_data=results
        )

    def get_snippets_for_node_pair(
        self,
        from_id: int,
        to_id: int,
        page: int,
        limit: int,
    ):
        data = self.get_snippets_from_node_pair(from_id, to_id, page, limit)
        total_results = self.get_snippet_count_from_node_pair(from_id, to_id)

        results = [
            GetSnippetsFromEdgeResult(
                from_node_id=from_id,
                to_node_id=to_id,
                association=row['description'],
                snippets=[Snippet(
                    reference=GraphNode(
                        reference['snippet']['id'],
                        'Snippet',
                        [],
                        snake_to_camel_dict(reference['snippet']['data'], {}),
                        [],
                        None,
                        None,
                    ),
                    publication=GraphNode(
                        reference['publication']['id'],
                        'Publication',
                        [],
                        snake_to_camel_dict(reference['publication']['data'], {}),
                        [],
                        None,
                        None,
                    ),
                    raw_score=reference['raw_score'],
                    normalized_score=reference['normalized_score']
                ) for reference in row['references']]
            ) for row in data
        ]

        return GetNodePairSnippetsResult(
            snippet_data=results,
            total_results=total_results,
            query_data={'from_node_id': from_id, 'to_node_id': to_id},
        )

    def get_expand_query(self, tx: Neo4jTx, node_id: str, labels: List[str]) -> List[Neo4jRecord]:
        return list(
            tx.run(
                """
                MATCH (n)
                WHERE ID(n)=$node_id
                MATCH (n)-[l:ASSOCIATED]-(m)
                WHERE any(x IN $labels WHERE x IN labels(m))
                RETURN
                    apoc.convert.toSet([n] + collect(m)) AS nodes,
                    apoc.convert.toSet(collect(l)) AS relationships
                """,
                node_id=node_id, labels=labels
            )
        )

    def get_associated_type_snippet_count_query(
        self,
        tx,
        sanitized_label: str,
        source_node: int,
        associated_nodes: List[int]
    ):
        return list(
            tx.run(
                f"""
                MATCH
                    (f)-[:HAS_ASSOCIATION]-(a:Association)-[:HAS_ASSOCIATION]-(t:{sanitized_label})
                WHERE
                    ID(f) = $source_node AND
                    ID(t) IN $associated_nodes
                WITH
                    a AS association,
                    t.name as name,
                    ID(t) as node_id
                MATCH (association)<-[:INDICATES]-(s:Snippet)-[:IN_PUB]-(p:Publication)
                RETURN name, node_id, COUNT(s) as snippet_count
                ORDER BY snippet_count DESC
                """,
                source_node=source_node, associated_nodes=associated_nodes
            ).data()
        )

    def get_snippets_from_edges_query(
        self,
        tx: Neo4jTx,
        from_ids: List[int],
        to_ids: List[int],
        description: str,
        skip: int,
        limit: int
    ) -> List[Neo4jRecord]:
        return list(
            tx.run(
                """
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
                MATCH (association)<-[r:INDICATES]-(s:Snippet)-[:IN_PUB]-(p:Publication)
                WITH
                    COUNT(s) as snippet_count,
                    collect({
                        snippet: {
                            id: s.id,
                            data: {
                                entry1_text: r.entry1_text,
                                entry2_text: r.entry2_text,
                                entry1_type: coalesce(association.entry1_type, 'Unknown'),
                                entry2_type: coalesce(association.entry2_type, 'Unknown'),
                                sentence: s.sentence
                            }
                        },
                        publication: {
                            id: p.id,
                            data: {
                                journal: p.journal,
                                title: p.title,
                                pmid: p.pmid,
                                pub_year: p.pub_year
                            }
                        },
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
                """,
                from_ids=from_ids, to_ids=to_ids, description=description, skip=skip, limit=limit
            )
        )

    def get_snippets_from_node_pair_query(
        self,
        tx: Neo4jTx,
        from_id: List[int],
        to_id: List[int],
        skip: int,
        limit: int
    ) -> List[Neo4jRecord]:
        return list(
            tx.run(
                """
                MATCH (f)-[:HAS_ASSOCIATION]-(a:Association)-[:HAS_ASSOCIATION]-(t)
                WHERE
                    ID(f)=$from_id AND
                    ID(t)=$to_id
                WITH
                    a AS association,
                    ID(f) as from_id,
                    ID(t) as to_id,
                    a.description as description
                MATCH (association)<-[r:INDICATES]-(s:Snippet)-[:IN_PUB]-(p:Publication)
                WITH
                    COUNT(s) as snippet_count,
                    collect({
                        snippet: {
                            id: s.id,
                            data: {
                                entry1_text: r.entry1_text,
                                entry2_text: r.entry2_text,
                                entry1_type: coalesce(association.entry1_type, 'Unknown'),
                                entry2_type: coalesce(association.entry2_type, 'Unknown'),
                                sentence: s.sentence
                            }
                        },
                        publication: {
                            id: p.id,
                            data: {
                                journal: p.journal,
                                title: p.title,
                                pmid: p.pmid,
                                pub_year: p.pub_year
                            }
                        },
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
                """,
                from_id=from_id, to_id=to_id, skip=skip, limit=limit
            )
        )

    def get_snippet_count_from_edges_query(
        self,
        tx: Neo4jTx,
        from_ids: List[int],
        to_ids: List[int],
        description: str
    ) -> Neo4jRecord:
        return tx.run(
            """
            MATCH (f)-[:HAS_ASSOCIATION]-(a:Association)-[:HAS_ASSOCIATION]-(t)
            WHERE
                ID(f) IN $from_ids AND
                ID(t) IN $to_ids AND
                a.description=$description
            WITH
                a AS association,
                ID(f) as from_id,
                ID(t) as to_id
            MATCH (association)<-[:INDICATES]-(s:Snippet)-[:IN_PUB]-(p:Publication)
            RETURN COUNT(s) as snippet_count
            """,
            from_ids=from_ids, to_ids=to_ids, description=description
        ).single()

    def get_snippet_count_from_node_pair_query(
        self,
        tx: Neo4jTx,
        from_id: int,
        to_id: int
    ) -> Neo4jRecord:
        return tx.run(
            """
            MATCH (f)-[:HAS_ASSOCIATION]-(a:Association)-[:HAS_ASSOCIATION]-(t)
            WHERE
                ID(f)=$from_id AND
                ID(t)=$to_id
            WITH
                a AS association,
                ID(f) as from_id,
                ID(t) as to_id
            MATCH (association)<-[:INDICATES]-(s:Snippet)-[:IN_PUB]-(p:Publication)
            RETURN COUNT(s) as snippet_count
            """,
            from_id=from_id, to_id=to_id
        ).single()

    def get_individual_snippet_count_from_edges_query(
        self,
        tx: Neo4jTx,
        from_ids: List[int],
        to_ids: List[int],
        description: str
    ) -> List[Neo4jRecord]:
        return list(
            tx.run(
                """
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
                OPTIONAL MATCH (association)<-[:INDICATES]-(s:Snippet)-[:IN_PUB]-(p:Publication)
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
                """,
                from_ids=from_ids, to_ids=to_ids, description=description
            )
        )
