import json
from typing import Dict, List, Union
from elasticsearch import Elasticsearch

from neo4japp.utils.queries import parse_query_terms


class PDFSearchResult:

    def __init__(self, data):
        self.file_id = ''
        self.filename = ''
        self.preview_text = ''
        self.doi = ''
        self.uploaded_date = ''
        self.highlight = data.get('highlight', {})
        self.preview_text_size = 400
        self.external_url = ''
        self.email = ''
        self.description = ''
        self.parse_pdf_entries(data)

    def parse_pdf_entries(self, data):
        source = data['_source']
        self.file_id = source['internal_link']
        self.doi = source['doi']
        self.preview_text = source['data']['content']
        self.preview_text = self.parse_highlight('data.content', self.preview_text)
        self.uploaded_date = source['uploaded_date']
        self.external_url = source['external_link']
        self.email = source['email']
        self.description = source['description']
        self.filename = source['filename']

    def parse_highlight(self, field, data):
        start_tag = '<highlight>'
        end_tag = '</highlight>'
        if field not in self.highlight:
            return data or ''

        bkp_data = ''

        for highlight in self.highlight[field]:
            untagged = highlight.replace(start_tag, '').replace(end_tag, '')
            tagged = highlight.replace(
                start_tag,
                '<strong class="highlight">'
            ).replace(
                end_tag,
                '</strong>'
            )
            bkp_data = '<br>'.join((bkp_data, tagged)) if bkp_data else tagged
            data = data.replace(untagged, tagged)

        if not data:
            data = bkp_data

        first_highlight = data.find('<strong')
        data = '...' + data[first_highlight - 20:first_highlight + self.preview_text_size] \
            if first_highlight < len(data) - self.preview_text_size \
            else '...' + data[-self.preview_text_size:]
        return data

    def to_json(self):
        return {
            'filename': self.filename,
            'file_id': self.file_id,
            'doi': self.doi,
            'preview_text': self.preview_text,
            'uploaded_date': self.uploaded_date,
            'external_url': self.external_url,
            'email': self.email,
            'description': self.description
        }

    def __str__(self):
        return json.dumps(self.to_json())

    def __repr__(self):
        return self.__str__()


# Constants
FRAGMENT_SIZE = 2147483647
WILDCARD_MIN_LEN = 3
ELASTICSEARCH_HOST = 'http://n4j-elasticsearch:9200'


class PDFSearch:
    """Wrapper around elastic search client"""

    def __init__(self):
        self.es = Elasticsearch(hosts=[ELASTICSEARCH_HOST])

    EmptyResult: Dict[str, Dict[str, Union[int, List[int], None]]] = \
        {'hits': {'hits': [], 'max_score': None, 'total': 0}}

    @classmethod
    def build_query_clause(cls, user_query: str, fields: List[str], boost_fields=None,
                           mode: str = 'AND'):
        if boost_fields is None:
            boost_fields = []
        terms, wildcards, phrases = parse_query_terms(user_query)

        if len(terms) == 0 and len(wildcards) == 0 and len(phrases) == 0:
            return None

        should_query = []
        if len(terms) > 0:
            all_terms = " ".join(terms)
            multi_match_fields = boost_fields + fields
            multi_match_dict = {'query': all_terms, 'fields': multi_match_fields, 'operator': mode}
            should_query.append({'multi_match': multi_match_dict})
        if len(wildcards) > 0:
            for field in fields:
                match_wildcards = [{'wildcard': {f'{field}': t}} for t in wildcards]
                should_query += match_wildcards
        if len(phrases) > 0:
            for field in fields:
                match_phrases = [{'match_phrase': {f'{field}': t}} for t in phrases]
                should_query += match_phrases

        predicates = [
            {'bool': {'should': should_query}}
        ]

        return {"bool": {'must': predicates}}

    @classmethod
    def build_es_query(cls, user_query: str):
        """Returns a dictionary representing the elastic search query object"""
        match_fields = ['filename', 'data.content']
        boost_fields = ['filename^3', 'description^3']
        query = cls.build_query_clause(user_query, match_fields, boost_fields)
        return {
            "query": query,
            "highlight": {
                "require_field_match": "false",
                "fields": {"*": {}},
                "fragment_size": FRAGMENT_SIZE,
                "pre_tags": ["<highlight>"],
                "post_tags": ["</highlight>"],
            }
        } if query else None

    def search(self, user_query: str, offset: int = 0, limit: int = 10):
        es_query = self.build_es_query(user_query)
        if es_query is None:
            return self.EmptyResult

        es_response = self.es.search(
            index='pdf',
            body=es_query,
            from_=offset,
            size=limit,
            rest_total_hits_as_int=True,
        )
        es_response['hits']['hits'] = [PDFSearchResult(x).to_json()
                                       for x in es_response['hits']['hits']]
        return es_response
