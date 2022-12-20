from arango.client import ArangoClient
import re
from typing import Any, Dict, List

from flask import current_app
from neo4j import Record as N4jRecord, Transaction as Neo4jTx

from neo4japp.constants import LogEventType
from neo4japp.data_transfer_objects import FTSQueryRecord, FTSTaxonomyRecord
from neo4japp.models import GraphNode
from neo4japp.services.arangodb import execute_arango_query, get_db
from neo4japp.services.common import GraphBaseDao
from neo4japp.util import normalize_str, snake_to_camel_dict
from neo4japp.utils.labels import (
    get_first_known_label_from_list,
    get_known_domain_labels_from_list
)
from neo4japp.utils.logger import EventLog


class SearchService(GraphBaseDao):

    def __init__(self, graph):
        super().__init__(graph)

    def _fulltext_query_sanitizer(self, query):
        """ Ensures the query is syntactically correct
        and safe from cypher injections for Neo4j full
        text search.

        Special characters in Lucene
        + - && || ! ( ) { } [ ] ^ " ~ * ? : \\ /
        See docs: http://lucene.apache.org/ for more information
        We will escape these characters with a forward ( \\ ) slash
        """
        lucene_chars = re.compile(r'([\+\-\&\|!\(\)\{\}\[\]\^"~\*\?:\/])')

        def escape(m):
            """ Adds an escape '\' to reserved Lucene characters"""
            char = m.group(1)
            return r'\{c}'.format(c=char)

        query = re.sub(lucene_chars, escape, query).strip()
        if not query:
            return query

        # Wrap the query in backticks, doubling existing backticks. This effectively escapes the
        # query input.
        return f"`{query.replace('`', '``')}`"

    def predictive_search(self, term: str, limit: int = 5):
        """ Performs a predictive search; not necessarily a prefix based autocomplete.
        # TODO: FIX the search algorithm to perform a proper prefix based autocomplete"""
        raise NotImplementedError


def _get_collection_filters(domains: List[str]):
    domains_list = [
        'chebi',
        'go',
        'mesh',
        'ncbi',
        'uniprot'
    ]

    result_domains = []

    # NOTE: If the user supplies an domain that *isn't* in these maps,
    # they may get unexpected results! We essentially silently ignore any
    # unexpected values in favor of getting *some* results back.

    for domain in domains:
        normalized_domain = normalize_str(domain)
        if normalized_domain in domains_list:
            result_domains.append(normalized_domain)
        else:
            current_app.logger.info(
                f'Found an unexpected value in `domains` list: {domain}',
                extra=EventLog(event_type=LogEventType.VISUALIZER_SEARCH.value).to_dict()
            )

    # If the domain list provided by the user is empty, then assume ALL domains/entities should be
    # used.
    result_domains = result_domains if len(result_domains) > 0 else domains_list

    return 'FILTER ' + \
           ' OR '.join([f'IS_SAME_COLLECTION("{domain}", entity._id)' for domain in result_domains])


def _get_labels_filter(entities: List[str]):
    entities_map = {
        'biologicalprocess': 'BiologicalProcess',
        'cellularcomponent': 'CellularComponent',
        'chemical': 'Chemical',
        'disease': 'Disease',
        'gene': 'Gene',
        'molecularfunction': 'MolecularFunction',
        'protein': 'Protein',
        'taxonomy': 'Taxonomy'
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
                extra=EventLog(event_type=LogEventType.VISUALIZER_SEARCH.value).to_dict()
            )

    # If the entity list provided by the user is empty, then assume ALL domains/entities should be
    # used.
    return result_entities if len(result_entities) > 0 else list(entities_map.values())


def _get_literature_match_string(domains: List[str]):
    literature_in_selected_domains = any([
        normalize_str(domain) == 'literature'
        for domain in domains
    ])

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
        return """
            LET literature_id = FIRST(
                FOR lit_doc IN INBOUND entity mapped_to
                    RETURN lit_doc._id
            )
            FILTER literature_id != null
        """


def _visualizer_search_result_formatter(result: List[Dict]) -> List[FTSQueryRecord]:
    formatted_results: List[FTSQueryRecord] = []
    for record in result:
        entity = record['entity']
        literature_id = record['literature_id']
        taxonomy_id = record.get('taxonomy_id', '')
        taxonomy_name = record.get('taxonomy_name', '')
        go_class = record.get('go_class', '')

        try:
            entity_label = get_first_known_label_from_list(entity["labels"])
        except ValueError:
            current_app.logger.warning(
                f'Node with ID {entity["id"]} had an unexpected list of labels: ' +
                f'{entity["labels"]}',
                extra=EventLog(event_type=LogEventType.KNOWLEDGE_GRAPH.value).to_dict()
            )
            entity_label = 'Unknown'

        graph_node = GraphNode(
            # When it exists, we use the literature node ID instead so the node can be expanded
            # in the visualizer
            id=literature_id or entity['id'],
            label=entity_label,
            sub_labels=entity['labels'],
            domain_labels=(
                get_known_domain_labels_from_list(entity['labels']) +
                (['Literature'] if literature_id is not None else [])
            ),
            display_name=entity['name'],
            data=snake_to_camel_dict(entity['data'], {}),
            url=None,
        )
        formatted_results.append(FTSTaxonomyRecord(
            node=graph_node,
            taxonomy_id=taxonomy_id if taxonomy_id is not None
            else 'N/A',
            taxonomy_name=taxonomy_name if taxonomy_name is not None
            else 'N/A',
            go_class=go_class if go_class is not None
            else 'N/A'
        ))
    return formatted_results


def get_organisms(arango_client: ArangoClient, term: str, limit: int) -> Dict[str, Any]:
    nodes = execute_arango_query(
        db=get_db(arango_client),
        query=get_organisms_query(),
        term=term,
        limit=limit
    )
    return {
        'limit': limit,
        'nodes': nodes,
        'query': term,
        'total': len(nodes),
    }


def get_organism_with_tax_id(arango_client: ArangoClient, tax_id: str):
    result = execute_arango_query(
        db=get_db(arango_client),
        query=get_organism_with_tax_id_query(),
        tax_id=tax_id
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
) -> List[FTSQueryRecord]:
    organism_match_string = f"""
        LET t = FIRST(
            FOR tax IN OUTBOUND entity has_taxonomy
            OPTIONS {{ vertexCollections: ["taxonomy"]}}
                {'FILTER tax.eid == @organism' if organism else ''}
                RETURN tax
        )
        {'FILTER t != null' if organism else ''}
    """
    collection_filters = _get_collection_filters(domains)
    types = _get_labels_filter(entities)
    literature_match_string = _get_literature_match_string(domains)
    query = visualizer_search_query(
        collection_filters,
        organism_match_string,
        literature_match_string
    )
    query_args = {
        'term': term,
        'types': types,
        'skip': (page - 1) * limit,
        'limit': limit
    }

    # The call to arango needs to exclude the "organism" parameter if it isn't present in the query.
    if organism:
        query_args['organism'] = organism

    result = execute_arango_query(
        db=get_db(arango_client),
        query=query,
        **query_args
    )

    return _visualizer_search_result_formatter(result)


def visualizer_search_count(
    arango_client: ArangoClient,
    term: str,
    organism: str,
    domains: List[str],
    entities: List[str],
):
    organism_match_string = f"""
        LET t = FIRST(
            FOR tax IN OUTBOUND entity has_taxonomy
            OPTIONS {{ vertexCollections: ["taxonomy"]}}
                {'FILTER tax.eid == @organism' if organism else ''}
                RETURN tax
        )
        {'FILTER t != null' if organism else ''}
    """
    collection_filters = _get_collection_filters(domains)
    types = _get_labels_filter(entities)
    literature_match_string = _get_literature_match_string(domains)
    count_query = visualizer_search_count_query(
        collection_filters,
        organism_match_string,
        literature_match_string
    )
    query_args = {
        'term': term,
        'types': types,
    }

    # The call to arango needs to exclude the "organism" parameter if it isn't present in the query.
    if organism:
        query_args['organism'] = organism

    return execute_arango_query(
        db=get_db(arango_client),
        query=count_query,
        **query_args
    )[0]


def get_synonyms(
    arango_client: ArangoClient,
    search_term: str,
    organisms: List[str],
    types: List[str],
    skip: int,
    limit: int
) -> List[dict]:
    labels_match_str = 'FILTER LENGTH(INTERSECTION(@types, entity.labels)) > 0' if types else ''
    organism_match_string = f"""
        LET t = FIRST(
            FOR tax IN OUTBOUND entity has_taxonomy
            OPTIONS {{ vertexCollections: ["taxonomy"]}}
                {'FILTER tax.eid IN @organisms' if organisms else ''}
                RETURN tax
        )
        {'FILTER t != null' if organisms else ''}
    """

    query_args = {
        'search_term': search_term,
        'types': types,
        'skip': skip,
        'limit': limit
    }

    # The call to arango needs to exclude the "organism" parameter if it isn't present in the query.
    if organisms:
        query_args['organisms'] = organisms

    results = execute_arango_query(
        db=get_db(arango_client),
        query=get_synonyms_query(labels_match_str, organism_match_string),
        **query_args
    )

    synonym_data = []
    for row in results:
        try:
            type = get_first_known_label_from_list(row['entity_labels'])
        except ValueError:
            type = 'Unknown'
            current_app.logger.warning(
                f"Node had an unexpected list of labels: {row['entity_labels']}",
                extra=EventLog(event_type=LogEventType.KNOWLEDGE_GRAPH.value).to_dict()
            )

        synonym_data.append({
            'type': type,
            'name': row['entity_name'],
            'organism': row['taxonomy_name'],
            'synonyms': row['synonyms'],
        })
    return synonym_data


def get_synonyms_count(
    arango_client: ArangoClient,
    search_term: str,
    organisms: List[str],
    types: List[str]
) -> int:
    labels_match_str = 'FILTER LENGTH(INTERSECTION(@types, entity.labels)) > 0' if types else ''
    organism_match_string = f"""
        LET t = FIRST(
            FOR tax IN OUTBOUND entity has_taxonomy
            OPTIONS {{ vertexCollections: ["taxonomy"]}}
                {'FILTER tax.eid IN @organisms' if organisms else ''}
                RETURN tax
        )
        {'FILTER t != null' if organisms else ''}
    """

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
        **query_args
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
                organism_name: t.name
            }
    """


def visualizer_search_query(
    arango_col_filters: str,
    organism_match_string: str,
    literature_match_filter: str
) -> str:
    """Need to collect synonyms because a gene node can have multiple
    synonyms. So it is possible to send duplicate internal node ids to
    a later query."""
    return f"""
        FOR s IN synonym_ft
            SEARCH PHRASE(s.name, @term, 'text_ll')
            SORT BM25(s) DESC
            FOR entity IN INBOUND s has_synonym
                {arango_col_filters}
                FILTER LENGTH(INTERSECTION(@types, entity.labels)) > 0 OR LENGTH(@types) == 0
                {organism_match_string}
                LET go_class = entity.namespace
                {literature_match_filter}
                LIMIT @skip, @limit
                RETURN DISTINCT {{
                    'entity': {{
                        'id': entity._id,
                        'name': entity.name,
                        'labels': entity.labels,
                        'data': {{
                            'eid': entity.eid,
                            'data_source': entity.data_source
                        }}
                    }},
                    'literature_id': literature_id,
                    'taxonomy_id': t.eid,
                    'taxonomy_name': t.name,
                    'go_class': go_class
                }}
    """


def visualizer_search_count_query(
    arango_col_filters: str,
    organism_match_string: str,
    literature_match_filter: str
) -> str:
    """Need to collect synonyms because a gene node can have multiple
    synonyms. So it is possible to send duplicate internal node ids to
    a later query."""
    return f"""
        RETURN LENGTH(
            FOR s IN synonym_ft
                SEARCH PHRASE(s.name, @term, 'text_ll')
                SORT BM25(s) DESC
                FOR entity IN INBOUND s has_synonym
                    {arango_col_filters}
                    FILTER LENGTH(INTERSECTION(@types, entity.labels)) > 0 OR LENGTH(@types) == 0
                    {organism_match_string}
                    LET go_class = entity.namespace
                    {literature_match_filter}
                    RETURN DISTINCT {{
                        'entity': {{
                            'id': entity._id,
                            'name': entity.name,
                            'labels': entity.labels,
                            'data': {{
                                'eid': entity.eid,
                                'data_source': entity.data_source
                            }}
                        }},
                        'literature_id': literature_id,
                        'taxonomy_id': t.eid,
                        'taxonomy_name': t.name,
                        'go_class': go_class
                    }}
        )
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
