from elasticsearch import Elasticsearch
from neo4japp.blueprints import SearchResult
from neo4japp.constants import ELASTICSEARCH_URL, GRAPH_INDEX


class EsSearch():
    es = Elasticsearch(ELASTICSEARCH_URL)

    @classmethod
    def build_search_query(cls, term: str):
        query = {
            "query": {
                "bool": {
                    "must": [{
                        "bool": {
                            "should": [{
                                "multi_match": {
                                        "query": term,
                                        "fields": ["common_name^3", "conjugate^3", "all_text"],
                                        "operator": "AND"
                                    }
                                }
                            ]}
                        }]
                    }
                },
            "highlight": {
                "require_field_match": "false",
                "fields": {"*": {}},
                "fragment_size": 2147483647,
                "pre_tags": ["@cfb-search-highlight@"],
                "post_tags": ["@/cfb-search-highlight@"]
            }
        }
        return query

    def search(self, search_term: str, offset: int = 0, limit: int = 100):
        es_query = self.build_search_query(search_term)
        res = self.es.search(
            index=GRAPH_INDEX,
            body=es_query,
            from_=offset, size=limit)
        hits = res['hits']
        elastic_hits = []
        if hits['hits']:
            for data in hits['hits']:
                hit = self._process_hit(data)
                elastic_hits.append(hit.to_dict())
        return elastic_hits

    def _process_hit(self, data) -> SearchResult:
        hit = SearchResult()
        hit.id = data['_id']
        hit.score = data['_score']
        source: dict = data['_source']
        hit.type = source['type']
        hit.labels = source['labels']
        hit.data_source = source['sourceId']
        hit.all_text = source['all_text']
        if 'common_name' in source:
            hit.common_name = source['common_name']
        if 'synonyms' in source:
            hit.synonyms = source['synonyms']
        if 'alt_id' in source:
            hit.alt_ids = source['alt_id']
        if 'conjugate' in source:
            hit.conjugate = source['conjugate']
        if 'organism' in source:
            hit.organism = source['organism']
        return hit
