import sqlalchemy
from sqlalchemy_searchable import inspect_search_vectors, search_manager


def ft_search(query, search_query, vector=None, regconfig=None):
    if not search_query.strip():
        return query

    if vector is None:
        entity = query._entities[0].entity_zero.class_
        search_vectors = inspect_search_vectors(entity)
        vector = search_vectors[0]

    if regconfig is None:
        regconfig = search_manager.options['regconfig']

    query = query.filter(
        vector.op('@@')(sqlalchemy.func.tsq_parse(regconfig, search_query))
    )

    query = query.add_columns(sqlalchemy.func.ts_rank_cd(
        vector,
        sqlalchemy.func.tsq_parse(search_query)
    ).label('rank'))

    return query.params(term=search_query)
