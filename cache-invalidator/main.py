from collections import defaultdict
from py2neo import Graph
import os
import time
import redis
import json

SUCCESSFUL_SLEEP_TIME = 3600 * 24       # refresh cached data this often
ERROR_INITIAL_SLEEP_TIME = 60           # if error occurs, try again sooner
ERROR_SLEEP_TIME_MULTIPLIER = 2         # on subsequent errors, sleep longer
ERROR_MAX_SLEEP_TIME = 3600 * 6         # but not longer than this
CACHE_EXPIRATION_TIME = 3600 * 24 * 14  # expire cached data


def main():
    next_error_sleep_time = ERROR_INITIAL_SLEEP_TIME
    while True:
        try:
            statistics = get_kg_statistics()
            cache_data("kg_statistics", statistics)

            next_error_sleep_time = ERROR_INITIAL_SLEEP_TIME
            time.sleep(SUCCESSFUL_SLEEP_TIME)

        except Exception as err:
            print(f"Error occured, will try again in {next_error_sleep_time} seconds: {err}")

            time.sleep(next_error_sleep_time)

            next_error_sleep_time = min(ERROR_MAX_SLEEP_TIME, next_error_sleep_time * ERROR_SLEEP_TIME_MULTIPLIER)


def get_kg_statistics():
    graph = Graph(
        host=os.environ.get("NEO4J_HOST"),
        auth=os.environ.get('NEO4J_AUTH').split('/')
    )
    labels_raw = graph.run("CALL db.labels()").data()
    labels = [label["label"] for label in labels_raw]
    db_labels = [label for label in labels if label.startswith('db_')]
    entity_labels = [label for label in labels if not label.startswith('db_') and label != 'Synonym']
    statistics = defaultdict(lambda: defaultdict())
    for db in db_labels:
        for entity in entity_labels:
            query = f"MATCH (:`{db}`:`{entity}`) RETURN count(*) as count"
            count = graph.run(query).evaluate()
            if count > 0:
                statistics[db.replace("db_", "", 1)][entity] = count
    return statistics


def cache_data(key, value):
    try:
        redis_server = redis.Redis(
            host=os.environ.get("REDIS_HOST"),
            port=os.environ.get("REDIS_PORT"),
            decode_responses=True
        )
        redis_server.set(key, json.dumps(value))
        redis_server.expire(key, CACHE_EXPIRATION_TIME)

    finally:
        redis_server.connection_pool.disconnect()


if __name__ == '__main__':
    main()
