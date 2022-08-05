from os import getenv

REDIS_URL = 'redis://{username}:{password}@{host}:{port}/{db}'.format(
        host=getenv('REDIS_HOST', 'localhost'),
        port=getenv('REDIS_PORT', '6379'),
        username=getenv('REDIS_USERNAME', 'default'),
        password=getenv('REDIS_PASSWORD', 'password'),
        db=getenv('REDIS_DB', '1')
    )

QUEUES = ['high', 'default', 'low']

NAME = 'default'
