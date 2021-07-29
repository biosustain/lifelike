import pandas as pd
from common.database import *
from common.constants import *


def _write_entity_list_for_LMDB(entity_node_label, database, output_dir):
    query = f"match (n:{entity_node_label}:{NODE_MESH})-[:HAS_SYNONYM]-(s) return n.id as id, n.name as name, s.name as synonym, n.data_source as data_source"
    df = database.get_data(query)
    filename = f"{entity_node_label}_list_for_LMDB.tsv"
    df.to_csv(os.path.join(output_dir, filename), sep='\t', index=False)


def write_mesh_annotation_files(database, output_dir):
    _write_entity_list_for_LMDB(NODE_DISEASE, database, output_dir)
    _write_entity_list_for_LMDB(NODE_FOOD, database, output_dir)
    _write_entity_list_for_LMDB(NODE_ANATOMY, database, output_dir)
    _write_entity_list_for_LMDB(NODE_PHENOMENA, database, output_dir)
