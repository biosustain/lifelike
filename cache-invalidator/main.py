import json
import logging
import os
import redis
import time

from collections import defaultdict
from neo4j import GraphDatabase, basic_auth


logger = logging.getLogger(__name__)
log_level = os.environ.get('LOG_LEVEL')
if log_level:
    log_level = getattr(logging, log_level.upper())
else:
    log_level = logging.WARNING

logger.setLevel(log_level)
print(f'Set log level to {log_level}')
logging.debug('Debug Logs')

SUCCESSFUL_SLEEP_TIME = 3600 * 24       # refresh cached data this often
ERROR_INITIAL_SLEEP_TIME = 60           # if error occurs, try again sooner
ERROR_SLEEP_TIME_MULTIPLIER = 2         # on subsequent errors, sleep longer
ERROR_MAX_SLEEP_TIME = 3600 * 6         # but not longer than this
CACHE_EXPIRATION_TIME = 3600 * 24 * 14  # expire cached data

REDIS_HOST = os.environ.get('REDIS_HOST')
REDIS_PORT = os.environ.get('REDIS_PORT')
REDIS_PASSWORD = os.environ.get('REDIS_PASSWORD')
REDIS_SSL = os.environ.get('REDIS_SSL', 'false').lower()
connection_prefix = 'rediss' if REDIS_SSL == 'true' else 'redis'
connection_url = f'{connection_prefix}://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/0'

# Establish Redis Connection
redis_server = redis.Redis(
    connection_pool=redis.BlockingConnectionPool.from_url(connection_url))

# Establish Neo4j Connection
host = os.getenv('NEO4J_HOST', '0.0.0.0')
scheme = os.getenv('NEO4J_SCHEME', 'bolt')
port = os.getenv('NEO4J_PORT', '7687')
url = f'{scheme}://{host}:{port}'
username, password = os.getenv('NEO4J_AUTH', 'neo4j/password').split('/')
neo4j_driver = GraphDatabase.driver(url, auth=basic_auth(username, password))

def main():
    next_error_sleep_time = ERROR_INITIAL_SLEEP_TIME
    while True:
        try:
            statistics = get_kg_statistics()
            cache_data("kg_statistics", statistics)
            next_error_sleep_time = ERROR_INITIAL_SLEEP_TIME
            logger.debug(f'Going to sleep for {SUCCESSFUL_SLEEP_TIME} seconds...')
        except Exception as err:
            logger.debug(f"Error occured, will try again in {next_error_sleep_time} seconds: {err}")
            time.sleep(next_error_sleep_time)
            next_error_sleep_time = min(ERROR_MAX_SLEEP_TIME, next_error_sleep_time * ERROR_SLEEP_TIME_MULTIPLIER)
        finally:
            try:
                precalculateGO()
                next_error_sleep_time = ERROR_INITIAL_SLEEP_TIME
                logger.debug(f'Going to sleep for {SUCCESSFUL_SLEEP_TIME} seconds...')
            except Exception as err:
                logger.debug(f"Error occured, will try again in {next_error_sleep_time} seconds: {err}")
                time.sleep(next_error_sleep_time)
                next_error_sleep_time = min(ERROR_MAX_SLEEP_TIME, next_error_sleep_time * ERROR_SLEEP_TIME_MULTIPLIER)
            else:
                time.sleep(SUCCESSFUL_SLEEP_TIME)



def get_kg_statistics():
    logger.debug("Getting Kg Statistics")
    graph = neo4j_driver.session()
    logger.debug("Kg Statistics Query start...")
    results = graph.read_transaction(lambda tx: tx.run('call db.labels()').data())
    logger.debug("Kg Statistics Query finished")
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
            logger.debug(f"NEO4J QUERY: {query}")
            result = graph.read_transaction(lambda tx: tx.run(query).data())
            count = result[0]['count']
            if count != 0:
                statistics[domain.replace('db_', '', 1)][entity] = count
    graph.close()
    return statistics


def precalculateGO():
    logger.debug("Precalculating GO...")
    graph = neo4j_driver.session()

    def fetch_organism_go_query(tx, organism):
        logger.debug(f"Precomputing GO for {organism['name']} ({organism['id']})")
        return tx.run(
            """
            MATCH (g:Gene)-[:GO_LINK {tax_id:$id}]-(go:db_GO)
            WITH go, collect(distinct g) as genes
            RETURN go.eid as goId,
                go.name as goTerm,
                [lbl in labels(go) where lbl <> 'db_GO'] as goLabel,
                [g in genes |g.name] as geneNames
            """,
            id=organism['id']
        ).data()

    organisms = graph.read_transaction(
            lambda tx: tx.run(
                """
                MATCH (t:Taxonomy)-[:HAS_TAXONOMY]-(:Gene)-[:GO_LINK]-(go:db_GO)
                with t, count(go) as c
                where c > 0
                RETURN t.eid as id, t.name as name
                """
            ).data()
    )

    for organism in organisms:
        logging.debug(f'Catching data for organism: {organism}')
        cache_data(f"GO_for_{organism['id']}", graph.read_transaction(fetch_organism_go_query, organism))
    graph.close()


def cache_data(key, value):
    try:
        redis_server.set(key, json.dumps(value))
        redis_server.expire(key, CACHE_EXPIRATION_TIME)
    finally:
        redis_server.connection_pool.disconnect()


if __name__ == '__main__':
    main()
