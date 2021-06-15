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
    query += f' ON (n:{label}) ASSERT n.{property_name} IS UNIQUE'
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
    query += f' for (n:{label}) on (n.{property_name})'
    return query


def get_drop_index_query(index_name:str):
    return f'DROP INDEX {index_name}'


def get_create_fulltext_index_query():
    """
    To run the query, need three params: $indexName as str, $labels as array and $properties as array
    :return:
    """
    return 'CALL db.index.fulltext.createNodeIndex($indexName, $labels, $properties)'

def get_create_nodes_query(node_label:str, id_name: str, properties:[], additional_labels=[], update_labels=False):
    """
    Build query that take a param $dict in the format {'rows': []}. Each row is a dict of prop_name-value pairs.
    e.g. for $dict = {'rows':[{'id': '123a', 'name':'abc'}, {'id':'456', 'name': 'xyz'}]}, the id_name should be 'id',
    and properties=['name']
    Make sure for each row, the keys match with properties
    :param node_label: the primary node label with id_name constraint or index
    :param id_name: the indexed property
    :param properties: node property names
    :param additional_labels: other node labels if exists
    :param update_labels: if True, always add the additional labels for the node, even the node is not newly created
    :return: cypher query with param $dict
    """
    query_rows = list()
    query_rows.append("WITH $dict.rows as rows UNWIND rows as row")
    query_rows.append("MERGE (n:%s {%s: row.%s})" % (node_label, id_name, id_name))
    if additional_labels or properties:
        prop_sets = []
        if additional_labels:
            label_set = 'n:' + ':'.join(additional_labels)
            prop_sets.append(label_set)
            if update_labels:
                query_rows.append('ON MATCH SET ' + label_set)
        if properties:
            props = ['n.' + prop + '=row.' + prop for prop in properties if prop != id_name]
            prop_sets += props
        if prop_sets:
            query_rows.append('ON CREATE SET ' + ','.join(prop_sets))
    return '\n'.join(query_rows)


def get_update_nodes_query(node_label:str, id_name: str, update_properties:[], additional_labels=[], update_only=False):
    """
    Build query to update nodes.  If a node not exists, and update_only = False, create one then update.
    The query will take a param $dict in the format {'rows': []}. Each row is a dict of prop_name-value pairs.
    e.g. for $dict = {'rows':[{'id': '123a', 'name':'abc'}, {'id':'456', 'name': 'xyz'}]}, the id_name should be 'id',
    and properties=['name']
    Make sure for each row, the keys match with properties
    :param node_label: the primary node label with id_name constraint or index
    :param id_name: the indexed property
    :param update_properties: node property names to be updated
    :param additional_labels: other node labels if exists
    :param update_only: if true, no new nodes will be added. Otherwise use merge node to add new nodes
    :return: query with param $dict
    """
    query_rows = list()
    query_rows.append("WITH $dict.rows as rows UNWIND rows as row")
    if update_only:
        query_rows.append("MATCH (n:%s {%s: row.%s})" % (node_label, id_name, id_name))
    else:
        query_rows.append("MERGE (n:%s {%s: row.%s})" % (node_label, id_name, id_name))
    if additional_labels or update_properties:
        prop_sets = []
        if additional_labels:
            label_set = 'n:' + ':'.join(additional_labels)
            prop_sets.append(label_set)
        if update_properties:
            props = ['n.' + prop + '=row.' + prop for prop in update_properties if prop != id_name]
            prop_sets += props
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
                                       node2_label, node2_id, node2_col,  relationship:str, rel_properties=[]):
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
    :return: cypher query with parameter $dict
    """
    rows = list()
    rows.append("WITH $dict.rows as rows UNWIND rows as row")
    rows.append("MATCH (a:%s {%s: row.%s}), (b:%s {%s: row.%s})" % (
        node1_label, node1_id, node1_col, node2_label, node2_id, node2_col))
    rows.append(f"MERGE (a)-[r:{relationship}]->(b)")
    if rel_properties:
        prop_sets = []
        for prop in rel_properties:
            prop_sets.append(f"r.{prop}=row.{prop}")
        set_phrase = ', '.join(prop_sets)
        rows.append(f"ON CREATE SET {set_phrase}")
    return '\n'.join(rows)


def get_create_nodes_relationships_query(node_label:str, node_id:str, node_col:str,
                                             node2_label, node2_id, node2_col,  relationship: str, forward=True,
                                             additional_new_node_label='', node_properties=[], rel_properties=[]):
    """
    Build the query to create node, then create relationship with another existing node using dataframe data.
    Dataframe need to transfer to dictionary using the following code: dict = {'rows': dataframe.to_dict('Records')}
    :param node_label: the label for the new node
    :param node_id: the new node id name, e.g. 'id', 'biocyc_id'
    :param node_col: the node id column name in the dataframe, e.g. 'start_id', 'string_id'
    :param node2_label: the other node label for the relationship.  This node need to be in database already
    :param node2_id: the other node id name
    :param node2_col: the dataframe column name for the other node id
    :param relationship: the relationship type
    :param forward: if true, node->node2, otherwise, node2->node
    :param additional_new_node_label: add additional label to the new node
    :param node_properties: new node properties to set
    :param rel_properties: relationship properties to set
    :return: cypher query with parameter $dict
    """
    query_rows = list()
    query_rows.append("WITH $dict.rows as rows UNWIND rows as row")
    query_rows.append("MERGE (a:%s {%s: row.%s})" % (node_label, node_id, node_col))
    if node_properties or additional_new_node_label:
        prop_sets = []
        if additional_new_node_label:
            prop_sets.append(f"a:{additional_new_node_label}")
        for prop in node_properties:
            if prop != node_id:
                prop_sets.append(f"a.{prop}=row.{prop}")
        set_phrase = ', '.join(prop_sets)
        query_rows.append(f" ON CREATE SET {set_phrase}")
    query_rows.append("WITH row, a MATCH (b:%s {%s: row.%s})" % (node2_label, node2_id, node2_col))
    if forward:
        query_rows.append(f"MERGE (a)-[r:{relationship}]->(b)")
    else:
        query_rows.append(f"MERGE (b)-[r:{relationship}]->(a)")
    if rel_properties:
        prop_sets = []
        for prop in rel_properties:
            prop_sets.append(f"r.{prop}=row.{prop}")
        set_phrase = ', '.join(prop_sets)
        query_rows.append(f"ON CREATE SET {set_phrase}")
    return '\n'.join(query_rows)

