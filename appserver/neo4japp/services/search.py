from arango.client import ArangoClient
from typing import Any, Dict, List

from flask import current_app

from neo4japp.constants import LogEventType
from neo4japp.data_transfer_objects import FTSQueryRecord, FTSTaxonomyRecord
from neo4japp.models import GraphNode
from neo4japp.services.arangodb import execute_arango_query, get_db
from neo4japp.utils.string import snake_to_camel_dict, normalize_str
from neo4japp.utils.labels import (
    get_first_known_label_from_list,
    get_known_domain_labels_from_data_source,
)
from neo4japp.utils.logger import EventLog


def _get_collection_filters(domains: List[str]):
    domains_list = [
        'chebi',
        'go',
        'mesh',
        'ncbi',
        # Include "taxonomy" here in case no domains were selected by the user. It has no use in
        # the for loop below.
        'taxonomy',
        'uniprot',
    ]

    result_domains = []

    # NOTE: If the user supplies an domain that *isn't* in these maps,
    # they may get unexpected results! We essentially silently ignore any
    # unexpected values in favor of getting *some* results back.

    for domain in domains:
        normalized_domain = normalize_str(domain)
        if normalized_domain in domains_list:
            result_domains.append(normalized_domain)

            # Add taxonomy if ncbi is included, since in the neo4j schema taxonomy nodes were part
            # of ncbi.
            if normalized_domain == 'ncbi':
                result_domains.append('taxonomy')
        else:
            current_app.logger.info(
                f'Found an unexpected value in `domains` list: {domain}',
                extra=EventLog(
                    event_type=LogEventType.VISUALIZER_SEARCH.value
                ).to_dict(),
            )

    # If the domain list provided by the user is empty, then assume ALL domains/entities should be
    # used.
    result_domains = result_domains if len(result_domains) > 0 else domains_list

    return 'FILTER ' + ' OR '.join(
        [f'IS_SAME_COLLECTION("{domain}", entity._id)' for domain in result_domains]
    )


def _get_labels_filter(entities: List[str]):
    entities_map = {
        'biologicalprocess': 'BiologicalProcess',
        'cellularcomponent': 'CellularComponent',
        'chemical': 'Chemical',
        'disease': 'Disease',
        'gene': 'Gene',
        'molecularfunction': 'MolecularFunction',
        'protein': 'Protein',
        'taxonomy': 'Taxonomy',
    }
    result_entities = []

    # NOTE: If the user supplies an entity that *isn't* in these maps,
    # they may get unexpected results! We essentially silently ignore any
    # unexpected values in favor of getting *some* results back.

    for entity in entities:
        normalized_entity = normalize_str(entity)
        if normalized_entity in entities_map:
            result_entities.append(entities_map[normalized_entity])
        else:
            current_app.logger.info(
                f'Found an unexpected value in `entities` list: {entity}',
                extra=EventLog(
                    event_type=LogEventType.VISUALIZER_SEARCH.value
                ).to_dict(),
            )

    # If the entity list provided by the user is empty, then assume ALL domains/entities should be
    # used.
    return result_entities if len(result_entities) > 0 else list(entities_map.values())


def _get_organism_match_string(organism: str):
    return f"""
        LET t = FIRST(
            FOR tax IN OUTBOUND entity has_taxonomy
            OPTIONS {{ vertexCollections: ["taxonomy"]}}
                {'FILTER tax.eid == @organism' if organism else ''}
                RETURN tax
        )
        {'FILTER t != null' if organism else ''}
    """


def _get_organisms_match_string(organisms: List[str]):
    return f"""
        LET t = FIRST(
            FOR tax IN OUTBOUND entity has_taxonomy
            OPTIONS {{ vertexCollections: ["taxonomy"]}}
                {'FILTER tax.eid IN @organisms' if organisms else ''}
                RETURN tax
        )
        {'FILTER t != null' if organisms else ''}
    """


def _get_labels_match_string(types: List[str]):
    return 'FILTER LENGTH(INTERSECTION(@types, entity.labels)) > 0' if types else ''


def _get_literature_match_string(domains: List[str]):
    literature_in_selected_domains = any(
        [normalize_str(domain) == 'literature' for domain in domains]
    )

    base_search_string = """
        LET literature_id = FIRST(
            FOR lit_doc IN INBOUND entity mapped_to
                RETURN lit_doc._id
        )
    """

    # Return nodes in one or more domains, with mapped Literature data (if it exists)
    if domains == [] or (len(domains) > 1 and literature_in_selected_domains):
        return base_search_string
    # Return nodes in one or more domains, and *exclude* Literature data from the result
    elif not literature_in_selected_domains:
        return "LET literature_id = null"
    # Return only nodes mapped to Literature nodes
    else:
        return (
            base_search_string
            + """
            \nFILTER literature_id != null
        """
        )


def _visualizer_search_result_formatter(result: dict) -> dict:
    formatted_results: List[FTSQueryRecord] = []
    for record in result['rows']:
        entity = record['entity']
        literature_id = record['literature_id']
        taxonomy_id = record.get('taxonomy_id', '')
        taxonomy_name = record.get('taxonomy_name', '')
        go_class = record.get('go_class', '')

        try:
            entity_label = get_first_known_label_from_list(entity["labels"])
        except ValueError:
            current_app.logger.warning(
                f'Node with ID {entity["id"]} had an unexpected list of labels: '
                + f'{entity["labels"]}',
                extra=EventLog(event_type=LogEventType.KNOWLEDGE_GRAPH.value).to_dict(),
            )
            entity_label = 'Unknown'

        graph_node = GraphNode(
            # When it exists, we use the literature node ID instead so the node can be expanded
            # in the visualizer
            id=literature_id or entity['id'],
            label=entity_label,
            sub_labels=entity['labels'],
            domain_labels=(
                get_known_domain_labels_from_data_source(entity['data']['data_source'])
                + (['Literature'] if literature_id is not None else [])
            ),
            display_name=entity['name'],
            data=snake_to_camel_dict(entity['data'], {}),
            url=None,
        )
        formatted_results.append(
            FTSTaxonomyRecord(
                node=graph_node,
                taxonomy_id=taxonomy_id if taxonomy_id is not None else 'N/A',
                taxonomy_name=taxonomy_name if taxonomy_name is not None else 'N/A',
                go_class=go_class if go_class is not None else 'N/A',
            )
        )
    return {'rows': formatted_results, 'count': result['count']}


def get_organisms(arango_client: ArangoClient, term: str, limit: int) -> Dict[str, Any]:
    nodes = execute_arango_query(
        db=get_db(arango_client), query=get_organisms_query(), term=term, limit=limit
    )
    return {
        'limit': limit,
        'nodes': nodes,
        'query': term,
        'total': len(nodes),
    }


def get_organism_with_tax_id(arango_client: ArangoClient, tax_id: str):
    result = execute_arango_query(
        db=get_db(arango_client), query=get_organism_with_tax_id_query(), tax_id=tax_id
    )
    return result[0] if len(result) else None


def visualizer_search(
    arango_client: ArangoClient,
    term: str,
    organism: str,
    domains: List[str],
    entities: List[str],
    page: int = 1,
    limit: int = 10,
) -> dict:
    collection_filters = _get_collection_filters(domains)
    types = _get_labels_filter(entities)
    literature_match_string = _get_literature_match_string(domains)
    organism_match_string = _get_organism_match_string(organism)
    query = visualizer_search_query(
        collection_filters,
        organism_match_string,
        literature_match_string,
        organism_required=True if organism else False,
        literature_required=(
            len(domains) == 1
            and any([normalize_str(domain) == 'literature' for domain in domains])
        ),
    )
    query_args = {
        'term': term,
        'types': types,
        'skip': (page - 1) * limit,
        'limit': limit,
    }

    # The call to arango needs to exclude the "organism" parameter if it isn't present in the query.
    if organism:
        query_args['organism'] = organism

    result = execute_arango_query(db=get_db(arango_client), query=query, **query_args)[
        0
    ]

    return _visualizer_search_result_formatter(result)


def get_synonyms(
    arango_client: ArangoClient,
    search_term: str,
    organisms: List[str],
    types: List[str],
    skip: int,
    limit: int,
) -> List[dict]:
    labels_match_str = _get_labels_match_string(types)
    organism_match_string = _get_organisms_match_string(organisms)

    query_args = {
        'search_term': search_term,
        'types': types,
        'skip': skip,
        'limit': limit,
    }

    # The call to arango needs to exclude the "organism" parameter if it isn't present in the query.
    if organisms:
        query_args['organisms'] = organisms

    results = execute_arango_query(
        db=get_db(arango_client),
        query=get_synonyms_query(labels_match_str, organism_match_string),
        **query_args,
    )

    synonym_data = []
    for row in results:
        try:
            type = get_first_known_label_from_list(row['entity_labels'])
        except ValueError:
            type = 'Unknown'
            current_app.logger.warning(
                f"Node had an unexpected list of labels: {row['entity_labels']}",
                extra=EventLog(event_type=LogEventType.KNOWLEDGE_GRAPH.value).to_dict(),
            )

        synonym_data.append(
            {
                'type': type,
                'name': row['entity_name'],
                'organism': row['taxonomy_name'],
                'synonyms': row['synonyms'],
            }
        )
    return synonym_data


def get_synonyms_count(
    arango_client: ArangoClient,
    search_term: str,
    organisms: List[str],
    types: List[str],
) -> int:
    labels_match_str = _get_labels_match_string(types)
    organism_match_string = _get_organisms_match_string(organisms)

    query_args = {
        'search_term': search_term,
        'types': types,
    }

    # The call to arango needs to exclude the "organism" parameter if it isn't present in the query.
    if organisms:
        query_args['organisms'] = organisms

    return execute_arango_query(
        db=get_db(arango_client),
        query=get_synonyms_count_query(labels_match_str, organism_match_string),
        **query_args,
    )[0]


def get_organisms_query() -> str:
    return """
        FOR n IN synonym_ft
            SEARCH PHRASE(n.name, @term, 'text_ll')
            SORT BM25(n) DESC
            FOR t IN INBOUND n has_synonym OPTIONS { vertexCollections: ["taxonomy" ] }
                LIMIT @limit
                RETURN {
                    tax_id: t.eid,
                    organism_name: t.name,
                    synonym: n.name
                }
    """


def get_organism_with_tax_id_query() -> str:
    return """
        FOR t IN taxonomy
            FILTER t.eid == @tax_id
            RETURN {
                tax_id: t.eid,
                organism_name: t.name,
                synonym: t.name
            }
    """


def visualizer_search_query(
    arango_col_filters: str,
    organism_match_string: str,
    literature_match_filter: str,
    organism_required: bool,
    literature_required: bool,
) -> str:
    """Need to collect synonyms because a gene node can have multiple
    synonyms. So it is possible to send duplicate internal node ids to
    a later query."""

    # The purpose of these dynamically chosen query strings is to prevent extra traversals from
    # being calculated. If organism or literature matching is not strictly required for a match,
    # we wait to do the matching until the last, paginated slice of data is acquired. This can mean
    # the difference between performing a traversal on potentially hundreds or thousands of
    # relationships, to instead just a handful.

    # It is especially useful when we need to find neither a literature nor an organism match. This
    # also has the benefit of allowing us to return the total count of results as well, rather than
    # do so in a separate query.
    both_required_str = f"""
        LET filtered_results = (
            FOR result IN unfiltered_results
                LET entity = result.entity.id
                {organism_match_string}
                {literature_match_filter}
                RETURN {{
                    'entity': result.entity,
                    'literature_id': literature_id,
                    'taxonomy_id': t.eid,
                    'taxonomy_name': t.name,
                    'go_class': result.go_class
                }}
        )
        LET final_count = LENGTH(filtered_results)
        LET final_result = (
            FOR result in filtered_results
                LIMIT @skip, @limit
                RETURN {{
                    'entity': result.entity,
                    'literature_id': result.literature_id,
                    'taxonomy_id': result.taxonomy_id,
                    'taxonomy_name': result.taxonomy_name,
                    'go_class': result.go_class
                }}
        )
        """

    literature_required_str = f"""
        LET filtered_results = (
            FOR result IN unfiltered_results
                LET entity = result.entity.id
                {literature_match_filter}
                RETURN {{
                    'entity': result.entity,
                    'literature_id': literature_id,
                    'go_class': result.go_class
                }}
        )
        LET final_count = LENGTH(filtered_results)
        LET final_result = (
            FOR result IN filtered_results
                // Limit BEFORE the organism matching to prevent unnecessary traversals
                LIMIT @skip, @limit
                LET entity = result.entity.id
                {organism_match_string}
                RETURN {{
                    'entity': result.entity,
                    'literature_id': result.literature_id,
                    'taxonomy_id': t.eid,
                    'taxonomy_name': t.name,
                    'go_class': result.go_class
                }}
        )
    """

    organism_required_str = f"""
        LET filtered_results = (
            FOR result IN unfiltered_results
                LET entity = result.entity.id
                {organism_match_string}
                RETURN {{
                    'entity': result.entity,
                    'taxonomy_id': t.eid,
                    'taxonomy_name': t.name,
                    'go_class': result.go_class
                }}
        )
        LET final_count = LENGTH(filtered_results)
        LET final_result = (
            FOR result IN filtered_results
                // Limit BEFORE the literature matching to prevent unnecessary traversals
                LIMIT @skip, @limit
                LET entity = result.entity.id
                {literature_match_filter}
                RETURN {{
                    'entity': result.entity,
                    'literature_id': literature_id,
                    'taxonomy_id': result.taxonomy_id,
                    'taxonomy_name': result.taxonomy_name,
                    'go_class': result.go_class
                }}
        )
    """

    neither_required_str = f"""
        LET final_count = LENGTH(unfiltered_results)
        LET final_result = (
            FOR result IN unfiltered_results
                // Limit BEFORE matching to prevent unnecessary traversals
                LIMIT @skip, @limit
                LET entity = result.entity.id
                {organism_match_string}
                {literature_match_filter}
                RETURN {{
                    'entity': result.entity,
                    'literature_id': literature_id,
                    'taxonomy_id': t.eid,
                    'taxonomy_name': t.name,
                    'go_class': result.go_class
                }}
        )
    """

    if organism_required and literature_required:
        pagination_query_str = both_required_str
    elif organism_required:
        pagination_query_str = organism_required_str
    elif literature_required:
        pagination_query_str = literature_required_str
    else:
        pagination_query_str = neither_required_str

    return f"""
        LET unfiltered_results = (
            FOR s IN synonym_ft
                SEARCH
                    PHRASE(s.name, @term, 'text_ll') OR
                    PHRASE(s.name, {{STARTS_WITH: TOKENS(@term, "text_ll")[0]}}, 'text_ll')
                FOR entity IN INBOUND s has_synonym
                    LET go_class = entity.namespace
                    // Need to manually add "Taxonomy" to the label list since taxonomy docs don't
                    // have labels as they would be redundant.
                    LET labels = UNION(
                        entity.labels,
                        IS_SAME_COLLECTION("taxonomy", entity._id) ? ["Taxonomy"] : []
                    )
                    {arango_col_filters}
                    FILTER LENGTH(INTERSECTION(@types, labels)) > 0 OR LENGTH(@types) == 0
                    COLLECT
                        score = BM25(s),
                        id = entity._id,
                        name = entity.name,
                        entity_labels = labels,
                        eid = entity.eid,
                        data_source = entity.data_source,
                        entity_go_class = go_class
                    SORT score DESC, name ASC
                    RETURN DISTINCT {{
                        'entity': {{
                            'id': id,
                            'name': name,
                            'labels': entity_labels,
                            'data': {{
                                'eid': eid,
                                'data_source': data_source
                            }}
                        }},
                        'go_class': entity_go_class
                    }}
        )
        {pagination_query_str}
        RETURN {{
            'count': final_count,
            'rows': final_result
        }}
    """


def get_synonyms_query(labels_match_str: str, organism_match_string: str) -> str:
    """
    Gets a list of synoynm data for a given search term. Data includes any matched entities, as
    well as any linked organism, if there is one.
    """
    return f"""
        FOR syn IN synonym
            FILTER syn.lowercase_name == @search_term
            FOR entity IN INBOUND syn has_synonym
                FILTER "Protein" NOT IN entity.labels
                {labels_match_str}
                LET synonyms = (
                    FOR syn2 IN OUTBOUND entity has_synonym
                    // Could use INTERSECTION here?
                    FILTER
                        length(syn2.name) > 2 OR
                        "Chemical" IN entity.labels OR
                        "Compound" IN entity.labels
                    RETURN syn2.name
                )
                LET matches_term = @search_term == LOWER(entity.name)
                LET syn_len = length(synonyms)
                {organism_match_string}
                SORT matches_term DESC, syn_len DESC
                LIMIT @skip, @limit
                RETURN DISTINCT {{
                    entity_name: entity.name,
                    taxonomy_name: t.name,
                    entity_labels: entity.labels,
                    synonyms: synonyms,
                    synonym_count: syn_len,
                    matches_term: matches_term
                }}
    """


def get_synonyms_count_query(labels_match_str: str, organism_match_string: str) -> str:
    """
    Gets the count of synoynm data for a given search term.
    """
    return f"""
        RETURN LENGTH(
            FOR syn IN synonym
                FILTER syn.lowercase_name == @search_term
                FOR entity IN INBOUND syn has_synonym
                    FILTER "Protein" NOT IN entity.labels
                    {labels_match_str}
                    LET synonyms = (
                        FOR syn2 IN OUTBOUND entity has_synonym
                        // Could use INTERSECTION here?
                        FILTER
                            length(syn2.name) > 2 OR
                            "Chemical" IN entity.labels OR
                            "Compound" IN entity.labels
                        RETURN syn2.name
                    )
                    LET matches_term = @search_term == LOWER(entity.name)
                    LET syn_len = length(synonyms)
                    {organism_match_string}
                    RETURN DISTINCT {{
                        entity_name: entity.name,
                        taxonomy_name: t.name,
                        entity_labels: entity.labels,
                        synonyms: synonyms,
                        synonym_count: syn_len,
                        matches_term: matches_term
                    }}
        )
    """
