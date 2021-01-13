import json

from typing import List

from neo4japp.exceptions import LMDBError
from neo4japp.database import LMDBConnection


class LMDBService(LMDBConnection):
    def get_lmdb_values(self, txn, key, token_type) -> List[dict]:
        """Return all values for an lmdb key."""
        lookup_key = key.encode('utf-8')
        if txn.get(lookup_key) is not None:
            cursor = txn.cursor()
            cursor.set_key(lookup_key)
            try:
                values = [json.loads(v) for v in cursor.iternext_dup()]
            except Exception:
                raise LMDBError(f'Failed token lookup for type "{token_type}".')
            cursor.close()
            return values
        else:
            return []

    def new_lmdb(self):
        # TODO: JIRA LL-315 from LL-256
        raise NotImplementedError
