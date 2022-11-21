from arango import ArangoClient
from arango.database import StandardDatabase
from datetime import datetime
from flask import current_app
from typing import Dict, List, Optional


# Helpers


def convert_datetime(date_val: str) -> str:
    return str(datetime.fromisoformat(date_val.replace("Z[UTC]", "")))


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


def execute_arango_query(db: StandardDatabase, query: str, **bind_vars) -> List[Dict]:
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
