import abc

from sqlalchemy.exc import SQLAlchemyError


class TransactionContext(metaclass=abc.ABCMeta):
    """Both __enter__ and __exit__ allows the class to be
    used with a `with` block.

    E.g
        engine = DatabaseConnection()
        with engine.begin() as session:
            ...

    E.g
        def __init__(self, conn):
            self.conn = conn

        def __enter__(self):
            self.session = self.conn.session()
            return self.session

        def __exit__(self, exc_type, exc_val, exc_traceback):
            self.session.close()

    This very much mirrors SQLAlchemy:
        https://github.com/sqlalchemy/sqlalchemy/blob/master/lib/sqlalchemy/future/engine.py#L394

    We don't need to do this for SQLAlchemy because
    flask-sqlalchemy does it for us, other databases we do.
    """

    @abc.abstractmethod
    def __enter__(self):
        raise NotImplementedError

    @abc.abstractmethod
    def __exit__(self, exc_type, exc_val, exc_traceback):
        raise NotImplementedError


class DatabaseConnection(metaclass=abc.ABCMeta):
    """Potentially using alongside a `with` context manager
    can have performance issues since python's `with` block is slow
    due to setting up a context manager.

    If multiple queries are needed within the same context, it might
    be worthwhile to implement:

    @property
    def session(self):
        if not self._session:
            self._session = self.conn.session()
        return self._session
    """

    @abc.abstractmethod
    def begin(self, **kwargs):
        """Needs to return an instance of TransactionContext
        as a nested class.
        """
        raise NotImplementedError


class GraphBaseDao:
    def __init__(self, graph, **kwargs):
        # TODO LL-2916: Should rename this to neo4j_session or something similar.
        # Also, use the correct typing.
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
        except SQLAlchemyError:
            self.session.rollback()
            raise

    def commit_or_flush(self, commit_now=True):
        if commit_now:
            self.commit()
        else:
            self.session.flush()


class HybridDBDao(GraphBaseDao, RDBMSBaseDao):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
