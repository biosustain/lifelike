from os import getenv

REDIS_URL = 'redis://:{password}@{host}:{port}/{db}'.format(
        host=getenv('REDIS_HOST', 'localhost'),
        port=getenv('REDIS_PORT', '6379'),
        password=getenv('REDIS_PASSWORD', ''),
        db=getenv('REDIS_DB', '1')
    )

QUEUES = ['high', 'default', 'low']

NAME = 'default'
