import pandas as pd
from common.database import *
from common.constants import *
from common.utils import get_data_dir, write_compressed_tsv_file_from_dataframe

def generate_pseudomonas_genelist_for_LMDB(database, output_dir):
    """
    Export PseudomonasCyc genes and synonyms to tsv file for LMDB annotation.
    Since there are no genes for tax id 160488 (Pseudomonas putida KT2440), we need to get the gene list from biocyc.
    """
    query = f"""
    match(n:Gene:db_PseudomonasCyc)-[:HAS_SYNONYM]-(s)
    return n.{PROP_ID} as id, n.name as geneName, s.name as synonym, 160488 as tax_id, 'BioCyc' as data_source
    """
    df = database.get_data(query)
    outfile = os.path.join(output_dir, "pseudomonasCyc_genes_for_LMDB.tsv")
    os.makedirs(output_dir, exist_ok=True)
    df.to_csv(outfile, index=False, sep='\t')


def generate_compound_list_for_LMDB(database, output_dir):
    """
    Export compound and synonyms to tsv file for LMDB annotation.
    Compound main change to Chemical in the future
    """
    query = """
    match(n:Compound)--[:HAS_SYNONYM]-(s)
    return n.eid as id, n.name as name, s.name as synonym,n.data_source as data_source
    """
    df = database.get_data(query)
    filename = "Compound_list_for_LMDB.tsv"
    print("write", filename)
    write_compressed_tsv_file_from_dataframe(df, filename, output_dir, zip_file=False)


def main():
    database = get_database()
    output_dir = f'{get_data_dir()}/processed/biocyc'
    generate_pseudomonas_genelist_for_LMDB(database, output_dir)
    generate_compound_list_for_LMDB(database, output_dir)
    database.close()

if __name__ == '__main__':
    main()
