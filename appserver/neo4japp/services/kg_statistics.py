from collections import defaultdict
from neo4japp.services.common import GraphBaseDao, RedisDao


class KgStatisticsService(GraphBaseDao, RedisDao):

    def __init__(self, graph, redis_conn):
        super().__init__(graph=graph, redis_conn=redis_conn)

    def get_kg_statistics(self):
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
        return statistics
