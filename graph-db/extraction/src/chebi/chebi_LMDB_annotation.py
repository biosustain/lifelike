from common.database import *
from common.constants import *
from datetime import datetime
from common.utils import write_compressed_tsv_file_from_dataframe, get_data_dir
import os

def write_chemical_list_for_LMDB(database: Database, output_dir: str):
    query = f"""
    match (n:{NODE_CHEMICAL}:{NODE_CHEBI})-[:HAS_SYNONYM]-(s) 
    return n.{PROP_ID} as id, n.name as name, s.name as synonym, n.data_source as data_source
    """
    df = database.get_data(query)
    datestr = datetime.now().strftime("%m%d%Y")
    filename = f"processed/chebi/{NODE_CHEMICAL}_list_for_LMDB_{datestr}.tsv"
    os.makedirs(f'{output_dir}/{filename}', exist_ok=True)
    write_compressed_tsv_file_from_dataframe(df, filename, output_dir)


def main():
    database = get_database()
    write_chemical_list_for_LMDB(database, get_data_dir())
    database.close()


if __name__ == "__main__":
    main()
