def get_create_database_query(db_name: str):
    return f'CREATE or REPLACE database {db_name}'


def get_drop_database_query(db_name: str):
    return f'DROP DATABASE {db_name}'


def get_create_constraint_query(label: str, property_name: str, constraint_name: str = ''):
    """
    Build query to create a constraint
    :param label: node label
    :param property_name: node property for the constraint
    :param constraint_name: the constrain name
    :return: cypher query
    """
    query = 'CREATE CONSTRAINT '
    if constraint_name:
        query += constraint_name
    query += f' IF NOT EXISTS ON (n:{label}) ASSERT n.{property_name} IS UNIQUE'
    return query


def get_drop_constraint_query(constraint_name: str):
    return f'DROP CONSTRAINT {constraint_name}'


def get_create_index_query(label: str, property_name: str, index_name=''):
    """
    get create index or composity index query. if properties contains
    """
    query = 'CREATE INDEX '
    if index_name:
        query += index_name
    query += f' IF NOT EXISTS FOR (n:{label}) ON (n.{property_name})'
    return query


def get_drop_index_query(index_name:str):
    return f'DROP INDEX {index_name}'


def get_create_fulltext_index_query():
    """
    To run the query, need three params: $indexName as str, $labels as array and $properties as array
    :return:
    """
    return 'CALL db.index.fulltext.createNodeIndex($indexName, $labels, $properties)'


def get_create_update_nodes_query(node_label:str, id_name: str, update_properties:[], additional_labels=[], datasource=None,
                           original_entity_type=None):
    """
    Build query to create or update nodes.  If a node not exists, and update_only = False, create one then update.
    The query will take a param $dict in the format {'rows': []}. Each row is a dict of prop_name-value pairs.
    e.g. for $dict = {'rows':[{'id': '123a', 'name':'abc'}, {'id':'456', 'name': 'xyz'}]}, the id_name should be 'id',
    and properties=['name']
    Make sure for each row, the keys match with properties
    :param node_label: the primary node label with id_name constraint or index
    :param id_name: the indexed property
    :param update_properties: node property names to be updated
    :param additional_labels: other node labels if exists
    :param datasource: e.g. KEGG, NCBI Gene
    :param original_entity_type: e.g. Gene, Protein, Chemical, Disease
    :return_node_count: If True, return COUNT(n).
    :return: query with param $dict
    """
    query_rows = list()
    query_rows.append("UNWIND $rows as row")
    query_rows.append("MERGE (n:%s {%s: row.%s})" % (node_label, id_name, id_name))
    if additional_labels or update_properties:
        prop_sets = []
        if additional_labels:
            label_set = 'n:' + ':'.join(additional_labels)
            prop_sets.append(label_set)
        if update_properties:
            props = [f"n.{prop}=row.{prop}" for prop in update_properties if prop != id_name]
            prop_sets += props
        if datasource:
            prop_sets.append(f"n.data_source='{datasource}'")
        if original_entity_type:
            prop_sets.append(f"n.original_entity_type='{original_entity_type}'")
        if len(prop_sets) > 0:
            query_rows.append('SET ' + ','.join(prop_sets))
    return '\n'.join(query_rows)


def get_delete_nodes_query(node_label: str, id_name: str):
    """
    build the query to delete a node by matching the node with the given property (id_name).  The query will
    have a parameter $id which is the matched value for the "id_name" property
    :param node_label: the label of the node to be deleted
    :param id_name: the
    :return: cypher query with parameter $ids where $ids is an array for ID's for deletion
    """
    return f'MATCH (n:{node_label}) where n in $ids with n DETACH DELETE n'


def get_create_relationships_query(node1_label:str, node1_id:str, node1_col:str,
                                       node2_label, node2_id, node2_col,  relationship:str, rel_properties=[], etl_load_id=None):
    """
    Build the query to create relationships from dataframe.  Dataframe need to transfer to dictionary using the following code:
    dict = {'rows': dataframe.to_dict('Records')}
    :param node1_label: starting node label
    :param node1_id:  starting node id property name (e.g. id, biocyc_id)
    :param node1_col: dataframe column name for the starting node id
    :param node2_label: ending node label
    :param node2_id: ending node id property name (e.g. id, biocyc_id)
    :param node2_col: dataframe column name for the ending node id
    :param relationship: the relationship type
    :param rel_properties: relationship properties
    :param etl_load_id: Id that (virtually) links a node to an EtlLoad node.
    :return: cypher query with parameter $dict
    """
    rows = list()
    rows.append("UNWIND $rows as row")
    rows.append("MATCH (a:%s {%s: row.%s}), (b:%s {%s: row.%s})" % (
        node1_label, node1_id, node1_col, node2_label, node2_id, node2_col))
    rows.append(f"MERGE (a)-[r:{relationship}]->(b)")
    prop_sets = []
    if rel_properties:
        for prop in rel_properties:
            prop_sets.append(f"r.{prop}=row.{prop}")
    if etl_load_id:
        prop_sets.append(f'r.etl_load_id="{etl_load_id}"')
    if prop_sets:
        set_phrase = ', '.join(prop_sets)
        rows.append(f"SET {set_phrase}")
    return '\n'.join(rows)


def get_create_synonym_relationships_query(node_label:str, node_id:str, node_id_col:str, synonym_col, rel_properties=[], etl_load_id=None, return_node_count: bool=False):
    """
    Build the query to create node, then create relationship with another existing node using dataframe data.
    Dataframe need to transfer to dictionary using the following code: dict = {'rows': dataframe.to_dict('Records')}
    :param node_label: the node label
    :param node_id: the node id name, e.g. 'id', 'biocyc_id'
    :param node_id_col: the node id column name in the dataframe, e.g. 'start_id', 'string_id'
    :param synonym_col: the dataframe column name for synonym
    :param rel_properties: relationship properties for HAS_SYNONYM
    :param etl_load_id: the version
    :return_node_count: If True, return COUNT(r).
    :return: cypher query with parameter $dict
    """
    query_rows = list()
    query_rows.append("UNWIND $rows as row")
    query_rows.append("MERGE (a:Synonym {name: row.%s}) set a.lowercase_name=toLower(row.%s)" % (synonym_col, synonym_col))
    query_rows.append("WITH row, a MATCH (b:%s {%s: row.%s})" % (node_label, node_id, node_id_col))
    query_rows.append("MERGE (b)-[r:HAS_SYNONYM]->(a)")
    prop_sets = []
    for prop in rel_properties:
        prop_sets.append(f"r.{prop}=row.{prop}")
    if etl_load_id:
        prop_sets.append(f"r.etl_load_id='{etl_load_id}'")
    if prop_sets:
        set_phrase = ', '.join(prop_sets)
        query_rows.append(f"SET {set_phrase}")
    if return_node_count:
        query_rows.append('RETURN COUNT(r)')
    return '\n'.join(query_rows)
