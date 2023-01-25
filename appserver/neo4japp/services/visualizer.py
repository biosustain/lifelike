from arango.client import ArangoClient
from flask.globals import current_app
from typing import Dict, List
from uuid import uuid4

from neo4japp.constants import (
    LogEventType,
    DISPLAY_NAME_MAP,
    DOMAIN_URLS_MAP,
    TYPE_CHEMICAL,
    TYPE_DISEASE,
    TYPE_GENE,
    TYPE_LITERATURE_CHEMICAL,
    TYPE_LITERATURE_DISEASE,
    TYPE_LITERATURE_GENE
)
from neo4japp.data_transfer_objects.visualization import (
    Direction,
    DuplicateEdgeConnectionData,
    EdgeConnectionData,
    GetBulkReferenceTableDataResult,
    GetClusterSnippetsResult,
    GetEdgeSnippetsResult,
    GetNodePairSnippetsResult,
    GetReferenceTableDataResult,
    GetSnippetsFromEdgeResult,
    ReferenceTableRow,
    Snippet,
    GetAssociatedTypesResult,
)
from neo4japp.models import GraphNode
from neo4japp.services.arangodb import execute_arango_query, get_db
from neo4japp.util import snake_to_camel_dict
from neo4japp.utils.labels import get_first_known_label_from_list
from neo4japp.utils.logger import EventLog


def _get_uri_of_node_data(id: int, label: str, entity_id: str):
    """Given node meta data returns the appropriate
    URL formatted with the node entity identifier.
    """
    # Can't get the URI of the node if there is no 'eid' property, so return None
    if entity_id is None:
        current_app.logger.warning(
            f'Node with EID {entity_id} does not have a URI.',
            extra=EventLog(event_type=LogEventType.KNOWLEDGE_GRAPH.value).to_dict()
        )
        return None

    url = None
    try:
        if label == TYPE_CHEMICAL:
            db_prefix, uid = entity_id.split(':')
            if db_prefix == 'CHEBI':
                url = DOMAIN_URLS_MAP['chebi'].format(uid)
            else:
                url = DOMAIN_URLS_MAP['MESH'].format(uid)
        elif label == TYPE_DISEASE:
            db_prefix, uid = entity_id.split(':')
            if db_prefix == 'MESH':
                url = DOMAIN_URLS_MAP['MESH'].format(uid)
            else:
                url = DOMAIN_URLS_MAP['omim'].format(uid)
        elif label == TYPE_GENE:
            url = DOMAIN_URLS_MAP['NCBI_Gene'].format(entity_id)
        elif label == TYPE_LITERATURE_CHEMICAL:
            db_prefix, uid = entity_id.split(':')
            if db_prefix == 'CHEBI':
                url = DOMAIN_URLS_MAP['chebi'].format(uid)
            else:
                url = DOMAIN_URLS_MAP['MESH'].format(uid)
        elif label == TYPE_LITERATURE_DISEASE:
            db_prefix, uid = entity_id.split(':')
            if db_prefix == 'MESH':
                url = DOMAIN_URLS_MAP['MESH'].format(uid)
            else:
                url = DOMAIN_URLS_MAP['omim'].format(uid)
        elif label == TYPE_LITERATURE_GENE:
            url = DOMAIN_URLS_MAP['NCBI_Gene'].format(entity_id)
    except KeyError:
        current_app.logger.warning(
            f'url_map did not contain the expected key value for node with:\n' +
            f'\tID: {id}\n'
            f'\tLabel: {label}\n' +
            f'\tURI: {entity_id}\n'
            'There may be something wrong in the database.',
            extra=EventLog(event_type=LogEventType.KNOWLEDGE_GRAPH.value).to_dict()
        )
    finally:
        return url


def get_document_for_visualizer(arango_client: ArangoClient, doc_id: str):
    doc = execute_arango_query(
        get_db(arango_client),
        query='RETURN DOCUMENT(@id)',
        id=doc_id
    )[0]
    label = get_first_known_label_from_list(doc['labels'])
    return GraphNode(
        id=doc['_id'],
        label=label,
        sub_labels=doc['labels'],
        domain_labels=[],
        display_name=doc.get(DISPLAY_NAME_MAP[label], 'Unknown'),
        data=snake_to_camel_dict(doc, {}),
        url=None
    ).to_dict()


def expand_node_as_clusters(arango_client: ArangoClient, node_id: str, filter_labels: List[str]):
    expansion_results = execute_arango_query(
        get_db(arango_client),
        query=get_expand_query(),
        node_id=node_id,
        labels=filter_labels
    )

    associations = dict()
    for row in expansion_results:
        description = row['description']
        direction = row['direction']
        pairs = row['pairs']
        association_key = f'{description}${direction}'

        duplicate_node_edge_pairs = []
        for pair in pairs:
            node = pair['node']
            edge = pair['edge']
            node_label = get_first_known_label_from_list(node['labels'])
            node_as_duplicate = {
                **node,
                'id': f'duplicateNode:{uuid4()}',
                'duplicate_of': node['id'],
                'label': node_label,
                'entity_url': _get_uri_of_node_data(node['id'], node_label, node['data']['id'])
            }

            edge_as_duplicate = {
                **edge,
                'to_label': get_first_known_label_from_list(edge['to_labels']),
                'from_label': get_first_known_label_from_list(edge['from_labels']),
                'id': f'duplicateNode:{uuid4()}',
                'duplicate_of': edge['id'],
                'from': node_id if edge['from'] == node_id else node_as_duplicate['id'],
                'to': node_id if edge['to'] == node_id else node_as_duplicate['id'],
                'original_from': edge['from'],
                'original_to': edge['to'],
            }

            duplicate_node_edge_pairs.append({
                'node': node_as_duplicate,
                'edge': edge_as_duplicate
            })
        associations[association_key] = duplicate_node_edge_pairs

    reference_tables = []
    for association, node_edge_pairs in associations.items():
        description, direction = association.split('$')
        reference_tables.append(
            get_reference_table_data(
                arango_client,
                node_edge_pairs,
                description,
                direction
            )
        )
    return GetBulkReferenceTableDataResult(
        reference_tables=reference_tables
    )


def get_associated_type_snippet_count(
    arango_client: ArangoClient,
    source_node: int,
    associated_nodes: List[int],
):
    results = execute_arango_query(
        db=get_db(arango_client),
        query=get_associated_type_snippet_count_query(),
        source_node=source_node,
        associated_nodes=associated_nodes
    )
    return GetAssociatedTypesResult(associated_data=results)


def get_snippets_for_node_pair(
    arango_client: ArangoClient,
    node_1_id: int,
    node_2_id: int,
    page: int,
    limit: int,
):
    data = get_snippets_from_node_pair(arango_client, node_1_id, node_2_id, page, limit)
    total_results = get_snippet_count_from_node_pair(arango_client, node_1_id, node_2_id)

    results = [
        GetSnippetsFromEdgeResult(
            from_node_id=row['from_id'],
            to_node_id=row['to_id'],
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
            ) for reference in row['references']]
        ) for row in data
    ]

    return GetNodePairSnippetsResult(
        snippet_data=results,
        total_results=total_results,
        query_data={'node_1_id': node_1_id, 'node_2_id': node_2_id},
    )


def get_snippets_from_node_pair(
    arango_client: ArangoClient,
    node_1_id: int,
    node_2_id: int,
    page: int,
    limit: int
):
    return execute_arango_query(
        get_db(arango_client),
        query=get_snippets_from_node_pair_query(),
        node_1_id=node_1_id,
        node_2_id=node_2_id,
        skip=(page - 1) * limit,
        limit=limit
    )


def get_snippet_count_from_node_pair(
    arango_client: ArangoClient,
    node_1_id: int,
    node_2_id: int,
):
    return execute_arango_query(
        db=get_db(arango_client),
        query=get_snippet_count_from_node_pair_query(),
        node_1_id=node_1_id,
        node_2_id=node_2_id
    )[0]


def get_snippets_from_edges(
    arango_client: ArangoClient,
    from_ids: List[str],
    to_ids: List[str],
    description: str,
    page: int,
    limit: int
):
    return execute_arango_query(
        get_db(arango_client),
        query=get_snippets_from_edges_query(),
        from_ids=from_ids,
        to_ids=to_ids,
        description=description,
        skip=(page - 1) * limit,
        limit=limit
    )


def get_reference_table_data(
    arango_client: ArangoClient,
    node_edge_pairs: List[Dict],
    description: str = None,
    direction: str = None
):
    # For duplicate edges, We need to remember which true node ID pairs map to which
    # duplicate node ID pairs, otherwise when we send the data back to the frontend
    # we won't know which duplicate nodes we should match the snippet data with
    ids_to_pairs = {
        (pair['edge']['original_from'], pair['edge']['original_to']): pair
        for pair in node_edge_pairs
    }

    # One of these lists will have all duplicates (depends on the direction
    # of the cluster edge). We remove the duplicates so we don't get weird query results.
    from_ids = list({pair['edge']['original_from'] for pair in node_edge_pairs})
    to_ids = list({pair['edge']['original_to'] for pair in node_edge_pairs})
    if description is None:
        description = node_edge_pairs[0]['edge']['label']  # Every edge should have the same label
    if direction is None:
        direction = Direction.FROM.value if len(from_ids) == 1 else Direction.TO.value

    counts = execute_arango_query(
        get_db(arango_client),
        query=get_snippet_count_from_edges_query(),
        from_ids=from_ids,
        to_ids=to_ids,
        description=description
    )

    reference_table_rows: List[ReferenceTableRow] = []
    for row in counts:
        pair = ids_to_pairs[(row['from_id'], row['to_id'])]
        reference_table_rows.append(ReferenceTableRow(
            node_id=pair['node']['id'],
            node_display_name=pair['node']['display_name'],
            node_label=pair['node']['label'],
            snippet_count=row['count'],
        ))

    return GetReferenceTableDataResult(
        reference_table_rows=reference_table_rows,
        duplicate_node_edge_pairs=node_edge_pairs,
        direction=direction,
        description=description
    )


def get_snippets_for_edge(
    arango_client: ArangoClient,
    edge: EdgeConnectionData,
    page: int,
    limit: int,
) -> GetEdgeSnippetsResult:
    from_ids = [edge.from_]
    to_ids = [edge.to]
    description = edge.label  # Every edge should have the same label

    data = get_snippets_from_edges(arango_client, from_ids, to_ids, description, page, limit)
    count_results = execute_arango_query(
        get_db(arango_client),
        query=get_snippet_count_from_edges_query(),
        from_ids=from_ids,
        to_ids=to_ids,
        description=description
    )
    total_results = sum(row['count'] for row in count_results)

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
    arango_client: ArangoClient,
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

    data = get_snippets_from_edges(arango_client, from_ids, to_ids, description, page, limit)
    count_results = execute_arango_query(
        get_db(arango_client),
        query=get_snippet_count_from_edges_query(),
        from_ids=from_ids,
        to_ids=to_ids,
        description=description
    )
    total_results = sum(row['count'] for row in count_results)

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
            ) for reference in row['references']]
        ) for row in data
    ]

    return GetClusterSnippetsResult(
        snippet_data=results,
        total_results=total_results,
        query_data=edges,
    )


def get_expand_query() -> str:
    return """
        FOR n IN literature
            FILTER n._id == @node_id
            FOR m, e IN ANY n associated
                FILTER LENGTH(INTERSECTION(@labels, m.labels)) > 0
                COLLECT description = e.description, outgoing = e._from == n._id INTO pairs = {
                    "node": {
                        "id": m._id,
                        "display_name": m.name,
                        "data": {
                            "name": m.name,
                            "id": m.eid,
                        },
                        "labels": m.labels,
                        "domain_labels": [],
                    },
                    "edge": {
                        "id": e._id,
                        "from": e._from,
                        "to": e._to,
                        "from_labels": DOCUMENT(e._from).labels,
                        "to_labels": DOCUMENT(e._to).labels,
                        "data": {
                            "description": e.description,
                            "association_id": e.association_id,
                            "type": e.type,
                        },
                        "label": "associated"
                    }
                }
                RETURN {
                    "description": description,
                    "direction": outgoing ? "Outgoing" : "Incoming",
                    "pairs": pairs
                }
    """


def get_associated_type_snippet_count_query() -> str:
    return """
        FOR associated_node IN @associated_nodes
            LET association_paths = (
                FOR v, assoc_edge IN ANY associated_node associated
                    FILTER
                        (assoc_edge._from == @source_node AND assoc_edge._to == associated_node) OR
                        (assoc_edge._from == associated_node AND assoc_edge._to == @source_node)
                    FOR v2, e2, has_assoc_path IN 1..2 OUTBOUND assoc_edge._from has_association
                        FILTER has_assoc_path.vertices[-1]._id == assoc_edge._to
                        RETURN DISTINCT {
                            "association": has_assoc_path.vertices[1],
                            "from_id": assoc_edge._from,
                            "to_id": assoc_edge._to
                        }
            )
            LET snippet_count = COUNT(
                FOR obj IN association_paths
                    FOR snippet, e IN INBOUND obj.association indicates
                        RETURN DISTINCT [
                            obj.from_id,
                            obj.to_id,
                            obj.association.description,
                            snippet.eid
                        ]
            )
            SORT snippet_count DESC, associated_node ASC
            RETURN {
                "node_id": associated_node,
                "name": DOCUMENT(associated_node).name,
                "snippet_count": snippet_count
            }
    """


def get_snippets_from_node_pair_query() -> str:
    return """
        LET unpaginated_results = (
            FOR v, assoc_edge IN ANY @node_2_id associated
                FILTER
                    (assoc_edge._from == @node_1_id AND assoc_edge._to == @node_2_id) OR
                    (assoc_edge._from == @node_2_id AND assoc_edge._to == @node_1_id)
                LET from_id = assoc_edge._from
                LET to_id = assoc_edge._to
                FOR v2, e2, has_assoc_path IN 1..2 OUTBOUND from_id has_association
                    FILTER has_assoc_path.vertices[-1]._id == to_id
                    LET association = has_assoc_path.vertices[1]
                    LET references = (
                        FOR snippet IN INBOUND association indicates
                            // If there are multiple "indicates" between the association and
                            // snippet, just get one of them to avoid extra rows
                            LET indicates_rel = FIRST(
                                FOR doc IN indicates
                                    FILTER doc._from == snippet._id
                                    FILTER doc._to == association._id
                                    RETURN doc
                            )
                            FOR publication IN OUTBOUND snippet in_pub
                                SORT publication.pub_year DESC
                                RETURN DISTINCT {
                                    "snippet": snippet,
                                    "publication": publication,
                                    "indicates_rel": indicates_rel,
                                }
                    )
                    LET snippet_count = LENGTH(references)
                    SORT snippet_count DESC, [from_id, to_id] ASC
                    FOR reference IN references
                        RETURN DISTINCT {
                            "snippet_count": snippet_count,
                            "from_id": from_id,
                            "to_id": to_id,
                            "description": association.description,
                            "reference": {
                                "snippet": {
                                    "id": reference.snippet.eid,
                                    "data": {
                                        "entry1_text": reference.indicates_rel.entry1_text,
                                        "entry2_text": reference.indicates_rel.entry2_text,
                                        "entry1_type": association.entry1_type,
                                        "entry2_type": association.entry2_type,
                                        "sentence": reference.snippet.sentence
                                    }
                                },
                                "publication": {
                                    "id": reference.publication.pmid,
                                    "data": {
                                        "journal": reference.publication.journal,
                                        "title": reference.publication.title,
                                        "pmid": reference.publication.pmid,
                                        "pub_year": reference.publication.pub_year
                                    }
                                }
                            }
                        }
        )
        LET paginated_results = (
            FOR result IN unpaginated_results
                LIMIT @skip, @limit
                return result
        )
        FOR result IN paginated_results
            COLLECT
                snippet_count = result.snippet_count,
                from_id = result.from_id,
                to_id = result.to_id,
                description = result.description
            INTO groups
            SORT snippet_count DESC, [from_id, to_id] ASC
            RETURN {
                "snippet_count": snippet_count,
                "from_id": from_id,
                "to_id": to_id,
                "description": description,
                "references": (
                    FOR obj IN groups
                        RETURN obj.result.reference
                )
            }
    """


def get_snippet_count_from_node_pair_query() -> str:
    return """
        LET association_paths = (
            FOR v, assoc_edge IN ANY @node_2_id associated
                FILTER
                    (assoc_edge._from == @node_1_id AND assoc_edge._to == @node_2_id) OR
                    (assoc_edge._from == @node_2_id AND assoc_edge._to == @node_1_id)
                FOR v2, e2, has_assoc_path IN 1..2 OUTBOUND assoc_edge._from has_association
                    FILTER has_assoc_path.vertices[-1]._id == assoc_edge._to
                    RETURN DISTINCT {
                        "association": has_assoc_path.vertices[1],
                        "from_id": assoc_edge._from,
                        "to_id": assoc_edge._to
                    }
        )
        LET snippet_count = COUNT(
            FOR obj IN association_paths
                FOR snippet, e IN INBOUND obj.association indicates
                    RETURN DISTINCT [
                        obj.from_id,
                        obj.to_id,
                        obj.association.description,
                        snippet.eid
                    ]
        )
        RETURN snippet_count
    """


def get_snippets_from_edges_query() -> str:
    return """
        LET unpaginated_results = (
            FOR source_node IN @from_ids
                FOR dest_node IN @to_ids
                    FOR v, assoc_edge IN INBOUND dest_node associated
                        FILTER assoc_edge._from == source_node
                        LET from_id = assoc_edge._from
                        LET to_id = assoc_edge._to
                        FOR v2, e2, has_assoc_path IN 1..2 OUTBOUND from_id has_association
                            FILTER has_assoc_path.vertices[-1]._id == to_id
                            LET association = has_assoc_path.vertices[1]
                            FILTER association.description == @description
                            LET references = (
                                FOR snippet IN INBOUND association indicates
                                    // If there are multiple "indicates" between the association
                                    // and snippet, just get one of them to avoid extra rows
                                    LET indicates_rel = FIRST(
                                        FOR doc IN indicates
                                            FILTER doc._from == snippet._id
                                            FILTER doc._to == association._id
                                            RETURN doc
                                    )
                                    FOR publication IN OUTBOUND snippet in_pub
                                        SORT publication.pub_year DESC
                                        RETURN DISTINCT {
                                            "snippet": snippet,
                                            "publication": publication,
                                            "indicates_rel": indicates_rel,
                                        }
                            )
                            LET snippet_count = LENGTH(references)
                            SORT snippet_count DESC, [from_id, to_id] ASC
                            FOR reference IN references
                                RETURN DISTINCT {
                                    "snippet_count": snippet_count,
                                    "from_id": from_id,
                                    "to_id": to_id,
                                    "description": association.description,
                                    "reference": {
                                        "snippet": {
                                            "id": reference.snippet.eid,
                                            "data": {
                                                "entry1_text": reference.indicates_rel.entry1_text,
                                                "entry2_text": reference.indicates_rel.entry2_text,
                                                "entry1_type": association.entry1_type,
                                                "entry2_type": association.entry2_type,
                                                "sentence": reference.snippet.sentence
                                            }
                                        },
                                        "publication": {
                                            "id": reference.publication.pmid,
                                            "data": {
                                                "journal": reference.publication.journal,
                                                "title": reference.publication.title,
                                                "pmid": reference.publication.pmid,
                                                "pub_year": reference.publication.pub_year
                                            }
                                        }
                                    }
                                }
        )
        LET paginated_results = (
            FOR result IN unpaginated_results
                LIMIT @skip, @limit
                return result
        )
        FOR result IN paginated_results
            COLLECT
                snippet_count = result.snippet_count,
                from_id = result.from_id,
                to_id = result.to_id,
                description = result.description
            INTO groups
            SORT snippet_count DESC, [from_id, to_id] ASC
            RETURN {
                "snippet_count": snippet_count,
                "from_id": from_id,
                "to_id": to_id,
                "description": description,
                "references": (
                    FOR obj IN groups
                        RETURN obj.result.reference
                )
            }
    """


def get_snippet_count_from_edges_query() -> str:
    return """
        FOR source_node IN @from_ids
            FOR dest_node IN @to_ids
                LET associations = (
                    FOR doc IN associated
                        FILTER doc._from == source_node
                        FILTER doc._to == dest_node
                        FILTER doc.description == @description
                        RETURN DOCUMENT(doc.association_id)
                )
                FILTER LENGTH(associations) > 0
                LET snippets_result = (
                    FOR association IN associations
                        FOR snippet, e IN INBOUND association indicates
                            RETURN DISTINCT [association.description, snippet._id]
                )
                LET snippet_count = LENGTH(snippets_result)
                SORT snippet_count DESC, [source_node, dest_node] ASC
                RETURN {
                    "from_id": source_node,
                    "to_id": dest_node,
                    "count": snippet_count,
                    "from_labels": DOCUMENT(source_node).labels,
                    "to_labels": DOCUMENT(dest_node).labels
                }
    """
