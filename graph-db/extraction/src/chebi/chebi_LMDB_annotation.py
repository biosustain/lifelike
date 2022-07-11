from common.database import *
from common.constants import *
from common.utils import write_compressed_tsv_file_from_dataframe, get_data_dir

def write_chemical_list_for_LMDB(database: Database, output_dir: str):
    query = f"""
    match (n:{NODE_CHEMICAL}:{NODE_CHEBI})-[:HAS_SYNONYM]-(s)
    return n.{PROP_ID} as id, n.name as name, s.name as synonym, n.data_source as data_source
    """
    df = database.get_data(query)
    filename = f"{NODE_CHEMICAL}_list_for_LMDB.tsv"
    write_compressed_tsv_file_from_dataframe(df, filename, output_dir, zip_file=False)


def main():
    database = get_database()
    write_chemical_list_for_LMDB(database, f'{get_data_dir()}/processed/chebi')
    database.close()


if __name__ == "__main__":
    main()
