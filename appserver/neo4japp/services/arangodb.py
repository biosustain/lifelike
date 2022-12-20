from arango import ArangoClient
from arango.database import StandardDatabase
from datetime import datetime
from flask import current_app
from typing import Any, Dict, List, Optional


# Helpers


def convert_datetime(date_val: str) -> datetime:
    try:
        # The inclusions from the original data load don't seem to have timezone info, so try
        # creating a datetime object without it first. This is likely a bug, as the inclusion_date
        # is also not a date object but a raw string.
        return datetime.strptime(date_val, '%Y-%m-%d %H:%M:%S')
    except ValueError:
        # If the above doesn't work, then the inclusion probably uses the time-zone format, which
        # is the correct one.
        return datetime.strptime(date_val, '%Y-%m-%dT%H:%M:%S.%fZ')


def get_version(client: ArangoClient):
    return client.version


def get_db(
    arango_client: ArangoClient,
    name: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None
):
    return arango_client.db(
        name=name or current_app.config.get('ARANGO_DB_NAME'),
        username=username or current_app.config.get('ARANGO_USERNAME'),
        password=password or current_app.config.get('ARANGO_PASSWORD'),
    )


def execute_arango_query(db: StandardDatabase, query: str, **bind_vars) -> List[Any]:
    cursor = db.aql.execute(query, ttl=600, max_runtime=600, bind_vars=bind_vars)
    return [row for row in cursor]


def create_db(sys_db: StandardDatabase, new_db_name: str):
    if not sys_db.has_database(new_db_name):
        sys_db.create_database(new_db_name)


def add_document_to_collection(
    db: StandardDatabase,
    doc: dict,
    colxn_name: str,
    overwrite: bool = False,
) -> Dict:
    collection = db.collection(colxn_name)
    return collection.insert(doc, return_new=True, overwrite=overwrite)


def add_many_to_collection(
    db: StandardDatabase, docs: List[dict], colxn_name: str
) -> List[Dict]:
    collection = db.collection(colxn_name)
    return collection.insert_many(docs, return_new=True)
