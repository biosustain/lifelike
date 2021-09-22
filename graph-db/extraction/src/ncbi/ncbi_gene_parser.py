from common.database import *
from common.base_parser import BaseParser
from common.constants import *
import pandas as pd
import logging


"""
Download ncbi genes from ftp://ftp.ncbi.nlm.nih.gov/gene/DATA/.  Parse gene_info file, and gene2go.

For gene synonyms, remove any names with only one letter, and remove names that contain no non-digit characters. 
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
        self.logger = logging.getLogger(__name__)

    def create_indexes(self, database: Database):
        database.create_constraint(NODE_GENE, PROP_ID, 'constraint_gene_id')
        database.create_index(NODE_GENE, PROP_NAME, 'index_gene_name')
        database.create_index(NODE_GENE, PROP_LOCUS_TAG, 'index_locus_tag')
        database.create_index(NODE_GENE, PROP_TAX_ID, 'index_gene_taxid')
        database.create_constraint(NODE_SYNONYM, PROP_NAME, 'constraint_synonym_name')

    def load_data_to_neo4j(self, database: Database):
        """
        :param database:
        :return:
        """
        self.logger.info("Parse and load bioinfo")
        self._load_bioinfo_to_neo4j(database)
        self.logger.info("Parse and load gene2go")
        self._load_gene2go_to_neo4j(database)
        self._update_gene_synonyms_in_neo4j(database)

    def _load_bioinfo_to_neo4j(self, database: Database):
        """
        Read bioinfo file, and load gene nodes, gene synonyms listed in the synonyms column.  Associate genes with taxonomy
        :param database: database to laod data
        :param update: if False, it is initial loading; if True, update the database (no node and relationship deletion)
        """
        query_genes = get_update_nodes_query(NODE_GENE, PROP_ID,
                                       [PROP_NAME, PROP_LOCUS_TAG, PROP_FULLNAME, PROP_TAX_ID, PROP_DATA_SOURCE],
                                       [NODE_NCBI, NODE_MASTER])

        query_synonyms = get_create_synonym_relationships_query(NODE_GENE, PROP_ID, PROP_ID, 'synonym')
        self.logger.debug(query_synonyms)
        gene_info_cols = [k for k in GENE_INFO_ATTR_MAP.keys()]
        geneinfo_chunks = pd.read_csv(self.gene_info_file, sep='\t', chunksize=10000, usecols=gene_info_cols)
        count_gene = 0
        count_gene2syn = 0
        for chunk in geneinfo_chunks:
            df = chunk.rename(columns=GENE_INFO_ATTR_MAP)
            # if gene name is 'NEWENTRY', ignore.
            df = df[df['name'] != 'NEWENTRY']
            df = df.replace('-', '')
            df = df.astype('str')
            df[PROP_DATA_SOURCE] = DS_NCBI_GENE
            df_syn = df[[PROP_ID, PROP_SYNONYMS]]
            df_syn = df_syn.set_index(PROP_ID).synonyms.str.split('|', expand=True).stack()
            df_syn = df_syn.reset_index().rename(columns={0: 'synonym'}).loc[:, [PROP_ID, 'synonym']]
            # ignore single letter synonym, and synonyms without letters
            df_syn = df_syn[df_syn['synonym'].str.len() > 1 & df_syn['synonym'].str.contains('[a-zA-Z]')]
            # add Gene Nodes
            database.load_data_from_dataframe(df, query_genes)
            count_gene += len(df)
            # load synonyms
            database.load_data_from_dataframe(df_syn, query_synonyms)
            count_gene2syn += len(df_syn)
        self.logger.info(f'Processed genes: {count_gene}, gene2syns: {count_gene2syn}')

        # use the following cypher query to create HAS_TAXONOMY relationship is much faster than using python
        self.logger.info('add gene2tax relationships')
        query_gene2tax = '''
        call apoc.periodic.iterate(
        "match(n:Gene:db_NCBI), (t:Taxonomy {id:n.tax_id}) return n, t",
        "merge (n)-[:HAS_TAXONOMY]->(t)",
        {batchSize:5000}
        );
        '''
        database.run_query(query_gene2tax)

    def _load_gene2go_to_neo4j(self, database:Database):
        chunks = pd.read_csv(self.gene2go_file, sep='\t', chunksize=10000, usecols=['GeneID', 'GO_ID'])
        query = get_create_relationships_query(NODE_GENE, PROP_ID, 'GeneID', NODE_GO, PROP_ID, 'GO_ID', REL_GO_LINK)
        count = 0
        for chunk in chunks:
            df = chunk.astype('str')
            count = count + len(df)
            database.load_data_from_dataframe(df, query)
        self.logger.info(f'Gene-Go processed: {count}')

        # add tax_id property for GO_LINK
        query = """
        call apoc.periodic.iterate(
        "match(n:db_GO)-[r:GO_LINK]-(g:Gene) return g.tax_id as taxid, r",
        "set r.tax_id = taxid",
        {batchSize: 5000}
        )
        """
        database.run_query(query)

    def _update_gene_synonyms_in_neo4j(self, database: Database):
        query_add_name_as_synonym = '''
        call apoc.periodic.iterate(
        "match (n:Gene:db_NCBI) return n",
        "merge (s:Synonym {name:n.name}) set s.lowercase_name = toLower(n.name) merge (n)-[:HAS_SYNONYM]->(s)",
        {batchSize:10000}
        );
        '''
        query_add_locustag_as_synonym = '''
        call apoc.periodic.iterate(
        "match(n:Gene:db_NCBI) where exists (n.locus_tag) and n.locus_tag <> '' and n.locus_tag <> n.name return n",
        "merge (s:Synonym {name:n.locus_tag}) set s.lowercase_name = toLower(n.locus_tag) merge (n)-[:HAS_SYNONYM]->(s)",
        {batchSize:10000}
        );
        '''
        self.logger.info("add gene name as synonym")
        database.run_query(query_add_name_as_synonym)
        self.logger.info("add locustag as synonym")
        database.run_query(query_add_locustag_as_synonym)


def main():
    parser = GeneParser()
    database = get_database()
    parser.load_data_to_neo4j(database)
    database.close()


if __name__ == "__main__":
    main()
