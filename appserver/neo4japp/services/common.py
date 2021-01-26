import json
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


class RedisDao:
    def __init__(self, redis_conn, **kwargs):
        self.redis = redis_conn
        super().__init__(**kwargs)

    def set_cache_data(self, key, value, cache_expiration=1209600):
        self.redis.set(key, json.dumps(value))
        self.redis.expire(key, cache_expiration)
        return self.redis.get(key)

    def get_cache_data(self, key):
        return self.redis.get(key)


class HybridDBDao(GraphBaseDao, RDBMSBaseDao):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
