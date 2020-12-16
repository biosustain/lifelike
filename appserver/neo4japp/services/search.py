from py2neo import cypher
import re
from typing import Any, Dict, List
from flask import current_app

from neo4japp.data_transfer_objects import (
    FTSQueryRecord,
    FTSReferenceRecord,
    FTSResult,
    FTSTaxonomyRecord
)
from neo4japp.models import GraphNode
from neo4japp.services.common import GraphBaseDao
from neo4japp.util import get_first_known_label_from_node


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
        # The cypher escape helps prevent whitespace separated
        # words from being searched as two individual words.
        return '{q}'.format(q=cypher.cypher_escape(query))

    def predictive_search(self, term: str, limit: int = 5):
        """ Performs a predictive search; not necessarily a prefix based autocomplete.
        # TODO: FIX the search algorithm to perform a proper prefix based autocomplete"""
        raise NotImplementedError

    def _visualizer_search_result_formatter(self, results) -> List[FTSQueryRecord]:
        formatted_results: List[FTSQueryRecord] = []
        for result in results:
            node = result['node']
            score = result['score']
            taxonomy_id = result.get('taxonomy_id', '')
            taxonomy_name = result.get('taxonomy_name', '')
            go_class = result.get('go_class', '')
            graph_node = GraphNode.from_py2neo(
                node,
                display_fn=lambda x: x.get('name'),
                primary_label_fn=get_first_known_label_from_node
            )
            formatted_results.append(FTSTaxonomyRecord(
                node=graph_node,
                score=score,
                taxonomy_id=taxonomy_id if taxonomy_id is not None
                else 'N/A',
                taxonomy_name=taxonomy_name if taxonomy_name is not None
                else 'N/A',
                go_class=go_class if go_class is not None
                else 'N/A'
            ))
        return formatted_results

    def sanitize_filter(
        self,
        domains: List[str],
        entities: List[str],
    ):
        domains_list = {'ChEBI': 'n:db_CHEBI', 'GO': 'n:db_GO', 'Literature': 'n:db_Literature',
                        'MeSH': 'n:db_MESH', 'NCBI': 'n:db_NCBI', 'UniProt': 'n:db_UniProt'}
        entities_list = {'Chemicals': 'n:Chemical', 'Diseases': 'n:Disease', 'Genes': 'n:Gene',
                         'Proteins': 'n:Protein', 'Taxonomy': 'n:Taxonomy'}
        result_domains = []
        result_entities = []

        for domain in domains:
            if domain in domains_list:
                result_domains.append(domains_list[domain])
            else:
                current_app.logger.info(f'Filter not found: {domain}')

        for entity in entities:
            if entity in entities_list:
                result_entities.append(entities_list[entity])
            else:
                current_app.logger.info(f'Filter not found: {entity}')

        # If the domain list or entity list provided by the user is empty, then assume ALL
        # domains/entities should be used.
        result_domains = result_domains if len(result_domains) > 0 else [val for val in domains_list.values()]  # noqa
        result_entities = result_entities if len(result_entities) > 0 else [val for val in entities_list.values()]  # noqa

        return f'({" OR ".join(result_domains)}) AND ({" OR ".join(result_entities)})'

    def visualizer_search(
        self,
        term: str,
        organism: str,
        domains: List[str],
        entities: List[str],
        page: int = 1,
        limit: int = 10,
    ) -> FTSResult:
        query_term = self._fulltext_query_sanitizer(term)
        if not query_term:
            return FTSResult(query_term, [], 0, page, limit)

        if organism:
            organism_match_string = 'MATCH (n)-[:HAS_TAXONOMY]-(t:Taxonomy {id: $organism})'
        else:
            organism_match_string = 'OPTIONAL MATCH (n)-[:HAS_TAXONOMY]-(t:Taxonomy)'

        result_filters = self.sanitize_filter(domains, entities)

        cypher_query = f"""
            CALL db.index.fulltext.queryNodes("synonymIdx", $search_term)
            YIELD node, score
            MATCH (node)-[]-(n)
            WHERE {result_filters}
            WITH score, n
            {organism_match_string}
            RETURN DISTINCT score as score, n AS node, t.id AS taxonomy_id,
                t.name AS taxonomy_name, n.namespace AS go_class
            SKIP $amount
            LIMIT $limit
        """

        results = self.graph.run(
            cypher_query,
            parameters={
                'organism': organism,
                'amount': (page - 1) * limit,
                'limit': limit,
                'search_term': query_term,
            }
        ).data()

        records = self._visualizer_search_result_formatter(results)

        total_query = f"""
            CALL db.index.fulltext.queryNodes("synonymIdx", $search_term)
            YIELD node, score
            MATCH (node)-[]-(n)
            WHERE {result_filters}
            WITH score, n
            {organism_match_string}
            RETURN DISTINCT score as score, n AS node, t.id AS taxonomy_id,
                t.name AS taxonomy_name, n.namespace AS go_class
            LIMIT 1001
        """

        total_results = len(self.graph.run(
            total_query,
            parameters={
                'search_term': query_term,
                'organism': organism
            }
        ).data())

        return FTSResult(term, records, total_results, page, limit)

    def get_organism_with_tax_id(self, tax_id):
        query = """
            MATCH (t:Taxonomy {id: $tax_id})
            RETURN t.id AS tax_id, t.name AS organism_name
        """

        result = self.graph.run(
            query,
            {
                'tax_id': tax_id,
            }
        ).data()

        return result[0] if len(result) else None

    def get_organisms(self, term: str, limit: int) -> Dict[str, Any]:
        query_term = self._fulltext_query_sanitizer(term)
        if not query_term:
            return {
                'limit': limit,
                'nodes': [],
                'query': query_term,
                'total': 0,
            }

        cypher_query = """
            CALL db.index.fulltext.queryNodes("synonymIdx", $term)
            YIELD node, score
            MATCH (node)-[]-(t:Taxonomy)
            with t, collect(node.name) as synonyms LIMIT $limit
            RETURN t.id AS tax_id, t.name AS organism_name, synonyms[0] AS synonym
        """
        terms = query_term.split(' ')
        query_term = ' AND '.join(terms)
        nodes = self.graph.run(
            cypher_query,
            parameters={
                'limit': limit,
                'term': query_term,
            }
        ).data()

        return {
            'limit': limit,
            'nodes': nodes,
            'query': query_term,
            'total': len(nodes),
        }
