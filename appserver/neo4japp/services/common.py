import json
from flask import current_app
from sqlalchemy.exc import SQLAlchemyError
from neo4japp.exceptions import DatabaseError


class GraphBaseDao:
    def __init__(self, graph, **kwargs):
        self.graph = graph
        super().__init__(**kwargs)


class RDBMSBaseDao:
    def __init__(self, session, **kwargs):
        self.session = session
        super().__init__(**kwargs)

    def exists(self, query) -> bool:
        return self.session.query(query.exists()).scalar()

    def commit(self):
        try:
            self.session.commit()
        except SQLAlchemyError as err:
            self.session.rollback()
            raise DatabaseError(str(err))

    def commit_or_flush(self, commit_now=True):
        if commit_now:
            self.commit()
        else:
            self.session.flush()


class HybridDBDao(GraphBaseDao, RDBMSBaseDao):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)


class RedisDao:
    def __init__(self, redis_conn, **kwargs):
        self.redis = redis_conn
        super().__init__(**kwargs)

    def set_cache_data(self, key, value, cache_expiration=1209600, key_prefix=None):
        """ This is used to distinguish between different environments
        since we connect to a single Redis instance and keys could
        potentially collide.
        """
        if key_prefix is None:
            key_prefix = current_app.config.get('REDIS_PREFIX')
        key = f'{key_prefix}_{key}'
        self.redis.set(key, json.dumps(value))
        self.redis.expire(key, cache_expiration)
        return self.redis.get(key)

    def get_cache_data(self, key, prepend_default_prefix=False):
        """ This is used to distinguish between different environments
        since we connect to a single Redis instance. By default, our
        setter will add the global Redis prefix.
        """
        if prepend_default_prefix:
            key_prefix = current_app.config.get('REDIS_PREFIX')
            key = f'{key_prefix}_{key}'
        return self.redis.get(key)
