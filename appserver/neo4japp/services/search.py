import re
from neo4japp.dto import FTSQueryRecord, FTSResult
from neo4japp.services.common import BaseDao
from neo4japp.models import GraphNode
from py2neo import cypher

class SearchService(BaseDao):

    def __init__(self, graph):
        super().__init__(graph)

    def _fulltext_query_sanitizer(self, query):
        """ Ensures the query is syntactically correct
        and safe from cypher injections for Neo4j full
        text search.

        Special characters in Lucene
        + - && || ! ( ) { } [ ] ^ " ~ * ? : \ /
        See docs: http://lucene.apache.org/ for more information
        We will escape these characters with a forward ( \ ) slash
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

    def fulltext_search(self, term: str, page: int = 1, limit: int = 10) -> FTSResult:
        query_term = self._fulltext_query_sanitizer(term)
        if not query_term:
            return dict(nodes=[], edges=[])
        cypher_query = """
            CALL db.index.fulltext.queryNodes("namesEvidenceAndId", $search_term)
            YIELD node, score
            RETURN ID(node) as id, node, score
            SKIP $page
            LIMIT $limit
        """
        records = self.graph.run(
            cypher_query,
            parameters={'page': page - 1,
                        'limit': limit,
                        'search_term': query_term,
                        }).data()

        def to_graph_node(data) -> GraphNode:
            return GraphNode.from_py2neo(
                data['node'],
                display_fn=lambda x: x.get('name', x.get('sentence'))
            )

        nodes = [FTSQueryRecord(to_graph_node(n), n['score']) for n in records]

        total_query = """
            CALL db.index.fulltext.queryNodes("namesEvidenceAndId", $search_term)
            YIELD node
            RETURN COUNT(node) as total
        """
        total_records = self.graph.run(
            total_query, parameters={'search_term': query_term}).evaluate()
        return FTSResult(query_term, nodes, total_records, page, limit)

    def predictive_search(self, term: str, limit: int = 5):
        """ Performs a predictive search; not necessarily a prefix based autocomplete.
        # TODO: FIX the search algorithm to perform a proper prefix based autocomplete"""
        raise NotImplementedError
