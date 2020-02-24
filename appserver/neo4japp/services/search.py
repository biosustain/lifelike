import re
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
            """ Adds an escape '\' character """
            char = m.group(1)
            return r'\{c}'.format(c=char)
        query = re.sub(lucene_chars, escape, query)
        return query

    def predictive_search(self, term: str, limit: int = 5):
        """ Performs a predictive search; not necessarily a prefix based autocomplete.
        # TODO: Potentially make this solely prefix based (similar to Google search)"""
        query_term = self._fulltext_query_sanitizer(term)
        if not query_term:
            return dict(nodes=[], edges=[])
        # The cypher escape helps prevent whitespace separated
        # words from being searched as two individual words.
        # The asterisk is a Lucene syntax for wild card search.
        query_term = '{q}*'.format(q=cypher.cypher_escape(query_term))
        cypher_query = """
            CALL db.index.fulltext.queryNodes("nameAndId", $search_term)
            YIELD node RETURN node LIMIT $size
        """
        records = self.graph.run(cypher_query, parameters={
                                 'search_term': query_term, 'size': limit}).data()
        nodes = [GraphNode.from_py2neo(
            n['node'], display_fn=lambda x: x.get('name')) for n in records]
        return dict(nodes=[n.to_dict() for n in nodes], edges=[])
