from common.database import *
from common.constants import *
from datetime import datetime
from common.utils import write_compressed_tsv_file_from_dataframe, get_data_dir


def _write_entity_list_for_LMDB(entity_node_label: str, database: Database, output_dir: str):
    query = f"match (n:{entity_node_label}:{NODE_MESH})-[:HAS_SYNONYM]-(s) return n.eid as id, n.name as name, s.name as synonym, n.data_source as data_source"
    df = database.get_data(query)
    filename = f"{entity_node_label}_list_for_LMDB.tsv"
    print("write", filename)
    write_compressed_tsv_file_from_dataframe(df, filename, output_dir, zip_file=False)

def write_mesh_annotation_files(database, output_dir):
    _write_entity_list_for_LMDB(NODE_DISEASE, database, f'{output_dir}/processed/disease')
    _write_entity_list_for_LMDB(NODE_FOOD, database, f'{output_dir}/processed/food')
    _write_entity_list_for_LMDB(NODE_ANATOMY, database, f'{output_dir}/processed/anatomy')
    _write_entity_list_for_LMDB(NODE_PHENOMENA, database, f'{output_dir}/processed/phenomena')


def main():
    database = get_database()
    write_mesh_annotation_files(database, get_data_dir())
    database.close()


if __name__ == "__main__":
    main()
