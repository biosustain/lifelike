import json
from collections import defaultdict
from neo4japp.services import rcache
from neo4japp.services.common import GraphBaseDao


class KgStatisticsService(GraphBaseDao):

    def __init__(self, graph):
        super().__init__(graph=graph)

    def get_kg_statistics(self, force_refresh=False):
        statistics = rcache.redis_server.get('kg_statistics')
        if not statistics or force_refresh:
            statistics = self.query_kg_statistics()
        else:
            statistics = json.loads(statistics)
        return statistics

    def _save_to_cache(self, data, cache_expiration=None):
        if cache_expiration is None:
            cache_expiration = 60 * 60 * 24 * 7
        rcache.redis_server.set('kg_statistics', data, ex=cache_expiration)

    def query_kg_statistics(self):
        results = self.graph.run('CALL db.labels()').data()
        domain_labels = []
        entity_labels = []
        for row in results:
            label = row['label']
            if label.startswith('db_'):
                domain_labels.append(label)
            elif label != 'Synonym':
                entity_labels.append(label)
        statistics = defaultdict(lambda: defaultdict())
        for domain in domain_labels:
            for entity in entity_labels:
                query = f'MATCH (:`{domain}`:`{entity}`) RETURN count(*) as count'
                count = self.graph.run(query).evaluate()
                if count != 0:
                    statistics[domain.replace('db_', '', 1)][entity] = count
        self.statistics = self._save_to_cache(json.dumps(statistics))
        return statistics
