from os import getenv

from neo4japp.constants import BASE_REDIS_URL, RQ_REDIS_DB

RQ_REDIS_URL = f"{BASE_REDIS_URL}/{RQ_REDIS_DB}"

QUEUES = ['high', 'default', 'low']

NAME = 'default'
