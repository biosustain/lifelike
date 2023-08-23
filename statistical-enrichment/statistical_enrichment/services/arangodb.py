from arango import ArangoClient
from arango.database import StandardDatabase
from flask import current_app
from typing import Any, List, Optional


def get_db(
    arango_client: ArangoClient,
    name: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
):
    return arango_client.db(
        name=name or current_app.config.get('ARANGO_DB_NAME'),
        username=username or current_app.config.get('ARANGO_USERNAME'),
        password=password or current_app.config.get('ARANGO_PASSWORD'),
    )


def execute_arango_query(db: StandardDatabase, query: str, **bind_vars) -> List[Any]:
    cursor = db.aql.execute(query, ttl=600, max_runtime=600, bind_vars=bind_vars)
    return [row for row in cursor]
