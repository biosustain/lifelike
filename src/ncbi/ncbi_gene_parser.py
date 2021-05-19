from common.database import *
from common.base_parser import BaseParser
from common.constants import *
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

"""
Download ncbi genes from ftp://ftp.ncbi.nlm.nih.gov/gene/DATA/.  Parse gene_info file, and gene2go.
"""

GENE_INFO_ATTR_MAP = {
    '#tax_id': PROP_TAX_ID,
    'GeneID': PROP_ID,
    'Symbol': PROP_NAME,
    'LocusTag': PROP_LOCUS_TAG,
    'Synonyms': PROP_SYNONYMS,
    'description': PROP_FULLNAME
}

class GeneParser(BaseParser):
    def __init__(self, base_dir=None):
        BaseParser.__init__(self, 'gene', base_dir)
        self.gene_info_file = os.path.join(self.download_dir, 'gene_info.gz')
        self.gene2go_file = os.path.join(self.download_dir, 'gene2go.gz')

    def create_indexes(self, database: Database):
        database.create_constraint(NODE_GENE, PROP_ID, 'constraint_gene_id')
        database.create_index(NODE_GENE, PROP_NAME, 'index_gene_name')
        database.create_index(NODE_GENE, PROP_LOCUS_TAG, 'index_locus_tag')

    def parse_and_write_data_files(self):
        self._parse_and_write_gene_info()
        self._parse_and_write_gene2go()

    def load_data_to_neo4j(self, database: Database, update=True):
        logging.info('parse and load bioinfo')
        self._load_bioinfo_to_neo4j(database, update)
        logging.info('parse and load gene2go')
        self._load_gene2go_to_neo4j(database)

    def write_lmdb_annotation_file(self):
        outfile = os.path.join(self.output_dir, 'gene_list_for_LMDB.tsv')
        open(outfile, 'w').close()
        gene_info_cols = [k for k in GENE_INFO_ATTR_MAP.keys()]
        geneinfo_chunks = pd.read_csv(self.gene_info_file, sep='\t', chunksize=20000, usecols=gene_info_cols)
        count = 0
        header = True
        for chunk in geneinfo_chunks:
            df = chunk.rename(columns=GENE_INFO_ATTR_MAP)
            df = df[df['name'] != 'NEWENTRY']
            df = df.replace('-', '').replace('')
            df_syn = df[[PROP_ID, PROP_NAME, PROP_SYNONYMS]]
            df_syn = df_syn.set_index([PROP_ID, PROP_NAME]).synonyms.str.split('|', expand=True).stack()
            df_syn = df_syn.reset_index().rename(columns={0: 'synonym'}).loc[:, [PROP_ID, PROP_NAME, 'synonym']]
            df_names = df[[PROP_ID, PROP_NAME]].copy()
            df_names['synonym'] = df[PROP_NAME]
            df_syns = pd.concat([df_names, df_syn])
            df_syns.drop_duplicates(inplace=True)
            df_syns = df_syns[df_syns['synonym'].str.len() > 1]
            print(len(df_names), len(df_syn), len(df_syns))
            df_syns[PROP_DATA_SOURCE] = DS_NCBI_GENE
            count += len(df_syns)
            df_syns.to_csv(outfile, header=header, sep='\t', mode='a')
            header = False
        logging.info(f'rows processed: {count}')

    def _parse_and_write_gene_info(self):
        # create new empty output files
        gene_file = os.path.join(self.output_dir, 'gene.tsv')
        gene2tax_file = os.path.join(self.output_dir, 'gene2tax.tsv')
        gene2synonym_file = os.path.join(self.output_dir, 'gene2syn.tsv')
        open(gene_file, 'w').close()
        open(gene2tax_file, 'w').close()
        open(gene2synonym_file, 'w').close()

        logging.info('Parse and load gene.info')
        gene_info_cols = [k for k in GENE_INFO_ATTR_MAP.keys()]
        geneinfo_chunks = pd.read_csv(self.gene_info_file, sep='\t', chunksize=200000, usecols=gene_info_cols)
        header = True
        for chunk in geneinfo_chunks:
            df = chunk.rename(columns=GENE_INFO_ATTR_MAP)
            df = df[df['name'] != 'NEWENTRY']
            df = df.replace('-', '').replace('')
            df_gene = df[[PROP_ID, PROP_NAME, PROP_LOCUS_TAG, PROP_FULLNAME, PROP_TAX_ID]]
            df_gene[PROP_DATA_SOURCE] = DS_NCBI_GENE
            df_tax = df[[PROP_ID, PROP_TAX_ID]]
            df_syn = df[[PROP_ID, PROP_SYNONYMS]]
            df_syn = df_syn.set_index(PROP_ID).synonyms.str.split('|', expand=True).stack()
            df_syn = df_syn.reset_index().rename(columns={0: 'synonym'}).loc[:, [PROP_ID, 'synonym']]
            # print(len(df_syn))
            df_syn = df_syn[df_syn['synonym'].str.len() > 1]
            # print(len(df_syn))
            df_gene.to_csv(gene_file, header=header, sep='\t', mode='a')
            df_tax.to_csv(gene2tax_file, header=header, sep='\t', mode='a')
            df_syn.to_csv(gene2synonym_file, header=header, sep='\t', mode='a')
            header = False

    def _parse_and_write_gene2go(self):
        gene2go_file = os.path.join(self.output_dir, 'gene2go.tsv')
        open(gene2go_file, 'w').close()
        chunks = pd.read_csv(self.gene2go_file, sep='\t', chunksize=10000, usecols=['GeneID', 'GO_ID'])
        header = True
        for chunk in chunks:
            df = chunk.drop_duplicates()
            df.to_csv(gene2go_file, header=header, sep='\t', mode='a')
            header = False

    def _load_bioinfo_to_neo4j(self, database: Database, update=False):
        gene_info_cols = [k for k in GENE_INFO_ATTR_MAP.keys()]
        geneinfo_chunks = pd.read_csv(self.gene_info_file, sep='\t', chunksize=10000, usecols=gene_info_cols)
        count_gene = 0
        count_gene2syn = 0
        for chunk in geneinfo_chunks:
            df = chunk.rename(columns=GENE_INFO_ATTR_MAP)
            df = df[df['name'] != 'NEWENTRY']
            df = df.replace('-', '').replace('')
            df = df.astype('str')
            df[PROP_DATA_SOURCE] = DS_NCBI_GENE
            # print(df.dtypes)
            # break
            df_syn = df[[PROP_ID, PROP_SYNONYMS]]
            df_syn = df_syn.set_index(PROP_ID).synonyms.str.split('|', expand=True).stack()
            df_syn = df_syn.reset_index().rename(columns={0: 'synonym'}).loc[:, [PROP_ID, 'synonym']]
            df_syn = df_syn[df_syn['synonym'].str.len() > 1]

            # add Gene Nodes
            query = get_update_nodes_query(NODE_GENE, PROP_ID,
                                           [PROP_NAME, PROP_LOCUS_TAG, PROP_FULLNAME, PROP_TAX_ID, PROP_DATA_SOURCE], [NODE_NCBI])
            if not update:
                query = get_create_nodes_query(NODE_GENE, PROP_ID,
                                               [PROP_NAME, PROP_LOCUS_TAG, PROP_FULLNAME, PROP_TAX_ID, PROP_DATA_SOURCE], [NODE_NCBI])
            database.load_data_from_dataframe(df, query)
            count_gene += len(df)

            # load gene2tax
            query = get_create_relationships_query(NODE_GENE, PROP_ID, PROP_ID, NODE_TAXONOMY, PROP_ID, PROP_TAX_ID, REL_TAXONOMY)
            database.load_data_from_dataframe(df, query)

            # load synonyms
            query = get_create_nodes_relationships_query(NODE_SYNONYM, PROP_NAME, 'synonym',
                                                         NODE_GENE, PROP_ID, PROP_ID, REL_SYNONYM, False)
            database.load_data_from_dataframe(df_syn, query)
            count_gene2syn += len(df_syn)
        logging.info(f'Processed genes: {count_gene}, gene2syns: {count_gene2syn}')

    def _load_gene2go_to_neo4j(self, database:Database):
        chunks = pd.read_csv(self.gene2go_file, sep='\t', chunksize=10000, usecols=['GeneID', 'GO_ID'])
        query = get_create_relationships_query(NODE_GENE, PROP_ID, 'GeneID', NODE_GO, PROP_ID, 'GO_ID', REL_GO_LINK)
        count = 0
        for chunk in chunks:
            df = chunk.astype('str')
            count = count + len(df)
            database.load_data_from_dataframe(df, query)
        logging.info(f'Gene-Go processed: {count}')


if __name__ == '__main__':
    parser = GeneParser()
    parser.write_lmdb_annotation_file()
    # database = get_database(Neo4jInstance.LOCAL, 'neo4j')
    # parser.load_data_to_neo4j(database)
    # database.close()
