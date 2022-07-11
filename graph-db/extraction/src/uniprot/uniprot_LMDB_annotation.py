from common.database import *
from common.utils import get_data_dir
from common.utils import write_compressed_tsv_file_from_dataframe


def generate_protein_list_for_LMDB(database, output_dir):
    """
    Export Uniprot Protein and synonyms to tsv file for LMDB annotation.
    Compound main change to Chemical in the future
    """
    query = """
    match (n:db_UniProt)-[:HAS_SYNONYM]-(s)
    return n.eid as id, n.name as name, s.name as synonym,n.data_source as data_source
    """
    df = database.get_data(query)
    filename = "Protein_list_for_LMDB.tsv"
    print("write", filename)
    write_compressed_tsv_file_from_dataframe(df, filename, output_dir, zip_file=False)


if __name__ == '__main__':
    database = get_database()
    generate_protein_list_for_LMDB(database, f'{get_data_dir()}/processed/uniprot')
    database.close()
