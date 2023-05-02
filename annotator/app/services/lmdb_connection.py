import abc
import lmdb

from os import path
from typing import Any, Dict

from app.logs import get_annotator_extras_obj, get_logger

from .exceptions import LMDBError

logger = get_logger()


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


class LMDBConnection(DatabaseConnection):
    def __init__(self, dirpath: str, **kwargs):
        self.dirpath = dirpath
        self.dbs: Dict[str, Any] = {}
        self.configs = kwargs

    class _context(TransactionContext):
        def __init__(self, env, db):
            self.db = db
            self.env: lmdb.Environment = env

        def __enter__(self):
            self.session = self.env.begin(self.db)
            return self.session

        def __exit__(self, exc_type, exc_val, exc_traceback):
            self.env.close()

    def begin(self, **kwargs):
        dbname = kwargs.get('dbname', '')
        create = kwargs.get('create', False)
        readonly = kwargs.get('readonly', True)

        if not dbname:
            logger.error(
                f'LMDB database name is invalid, cannot connect to {dbname}.',
                extra=get_annotator_extras_obj()
            )
            raise LMDBError(
                title='Cannot Connect to LMDB',
                message='Unable to connect to LMDB, database name is invalid.')

        dbpath = path.join(self.dirpath, self.configs[dbname])
        try:
            # Important to set locking to false, otherwise the annotators will fall over each other
            env: lmdb.Environment = lmdb.open(
                path=dbpath,
                create=create,
                readonly=readonly,
                max_dbs=2,
                lock=False
            )
        except Exception:
            logger.error(
                f'Failed to open LMDB environment in path {dbpath}.',
                extra=get_annotator_extras_obj()
            )
            raise LMDBError(
                title='Cannot Connect to LMDB',
                message='Encountered unexpected error connecting to LMDB.'
            )

        try:
            """
            !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            IMPORTANT NOTE: As of lmdb 0.98
            !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            In order for `dupsort` to work, need to provide a database name to
            `open_db()`, e.g open_db(b'db2', dupsort=True).

            If no database name is passed in, it will open the default database,
            and the transaction and cursor will point to the wrong address in
            memory and retrieve whatever is there.
            """
            if dbname not in self.dbs:
                db = env.open_db(key=dbname.encode('utf-8'), create=create, dupsort=True)
                self.dbs[dbname] = db
            else:
                db = self.dbs[dbname]
            return self._context(env, db)
        except Exception:
            logger.error(
                f'Failed to open LMDB database named {dbname}.',
                extra=get_annotator_extras_obj()
            )
            raise LMDBError(
                title='Cannot Connect to LMDB',
                message='Encountered unexpected error connecting to LMDB.'
            )
