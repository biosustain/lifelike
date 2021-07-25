import pandas as pd
from common.database import *
from common.utils import get_data_dir

def generate_pseudomonas_genelist_for_LMDB():
    """
    Export PseudomonasCyc genes and synonyms to tsv file for LMDB annotation.
    Since there are no genes for tax id 160488 (Pseudomonas putida KT2440), we need to get the gene list from biocyc.
    """
    database = get_database()
    query = """
    match(n:Gene:db_PseudomonasCyc)-[:HAS_SYNONYM]-(s) 
    return n.id as geneId, n.name as geneName, s.name as synonym, 160488 as tax_id, 'BioCyc' as data_source
    """
    df = database.get_data(query)
    outfile = os.path.join(get_data_dir(), "pseudomonasCyc_genes_for_LMDB.tsv")
    df.to_csv(outfile, index=False, sep='\t')


if __name__ == '__main__':
    generate_pseudomonas_genelist_for_LMDB()


