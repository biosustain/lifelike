from os import getenv

from neo4japp.constants import BASE_REDIS_URL, REDIS_DB

REDIS_URL = f"{BASE_REDIS_URL}/{REDIS_DB}"

QUEUES = ['high', 'default', 'low']

NAME = 'default'
