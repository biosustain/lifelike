import lmdb
from typing import Any, Dict
from flask import current_app

from neo4japp.constants import LogEventType
from neo4japp.utils.logger import EventLog

from neo4japp.exceptions import LMDBError


class LMDBConnector:
    def __init__(self, dirpath: str, **kwargs) -> None:
        self.dirpath = dirpath
        self.dbs: Dict[str, Any] = {}
        self.configs = kwargs

    # both __enter__ and __exit__ allows the class
    # to be use with a `with` block
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_traceback):
        self.env.close()

    def open_db(self, dbname: str, create: bool = False, readonly: bool = True):
        if not dbname:
            current_app.logger.error(
                f'LMDB database name is invalid, cannot connect to {dbname}.',
                extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            )
            raise LMDBError(
                title='Cannot Connect to LMDB',
                message='Unable to connect to LMDB, database name is invalid.')

        dbpath = f'{self.dirpath}{self.configs[dbname]}'
        try:
            self.env = lmdb.open(path=dbpath, create=create, readonly=readonly, max_dbs=2)
        except Exception:
            current_app.logger.error(
                f'Failed to open LMDB environment in path {dbpath}.',
                extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            )
            raise LMDBError(
                title='Cannot Connect to LMDB',
                message=f'Encountered unexpected error connecting to LMDB.')

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
            db = self.env.open_db(key=dbname.encode('utf-8'), create=create, dupsort=True)
            self.dbs[dbname] = db
            # return transaction
            return self.env.begin(db)
        except Exception:
            current_app.logger.error(
                f'Failed to open LMDB database named {dbname}.',
                extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            )
            raise LMDBError(
                title='Cannot Connect to LMDB',
                message=f'Encountered unexpected error connecting to LMDB.')
