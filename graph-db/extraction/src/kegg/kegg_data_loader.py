from common.base_data_loader import BaseDataLoader
from common.constants import *
from common.database import *
from common.utils import get_data_dir

class KeggDataLoader(BaseDataLoader):
    def __init__(self, basedir):
        BaseDataLoader.__init__(self, DB_KEGG.lower(), basedir)
        self.logger = logging.getLogger(__name__)

    def create_indexes(self, database: Database):
        database.create_constraint(NODE_KEGG, PROP_ID, "constraint_kegg_id")
        database.create_constraint(NODE_KO, PROP_ID, 'constraint_ko_id')
        database.create_constraint(NODE_PATHWAY, PROP_ID, 'constraint_pathway_id')
        database.create_constraint(NODE_GENE, PROP_ID, 'constraint_gene_id')
        database.create_constraint(NODE_GENOME, PROP_ID, 'constraint_genome_id')
        database.create_constraint(NODE_SYNONYM, PROP_NAME, 'constraint_synonym_name')
        database.create_index(NODE_PATHWAY, PROP_NAME, 'index_pathway_name')

    def load_data_to_neo4j(self, database: Database):
        # load pathway
        self.logger.info('load pathways')
        df = pd.read_csv(os.path.join(self.output_dir, 'pathway_data.tsv'), sep='\t', dtype={PROP_ID: str})
        df[PROP_DATA_SOURCE] = 'KEGG'
        cols = [PROP_ID, PROP_NAME, PROP_DATA_SOURCE]
        query = get_create_nodes_query(NODE_KEGG, PROP_ID, cols, [NODE_PATHWAY])
        self.logger.info(query)
        database.load_data_from_dataframe(df, query)

        # load ko
        self.logger.info('load ko')
        df = pd.read_csv(os.path.join(self.output_dir, 'ko_data.tsv'), sep='\t')
        df[PROP_DATA_SOURCE] = 'KEGG'
        cols = [PROP_ID, PROP_NAME, PROP_DEF, PROP_DATA_SOURCE]
        query = get_create_nodes_query(NODE_KEGG, PROP_ID, cols, [NODE_KO])
        self.logger.info(query)
        database.load_data_from_dataframe(df, query)

        self.logger.info('load gene')
        df = pd.read_csv(os.path.join(self.output_dir, 'gene_data.tsv'), sep='\t', dtype={PROP_GENE_ID: str})
        df[PROP_DATA_SOURCE] = 'KEGG'
        cols = [PROP_ID, PROP_GENOME, PROP_GENE_ID, PROP_DATA_SOURCE]
        query = get_create_nodes_query(NODE_KEGG, PROP_ID, cols, [NODE_GENE])
        self.logger.info(query)
        database.load_data_from_dataframe(df, query, 5000)
        self.logger.info('load gene-ncbi gene relationships')
        query = get_create_relationships_query(NODE_KEGG, PROP_ID, PROP_ID, NODE_GENE, PROP_ID, PROP_GENE_ID,
                                               REL_IS)
        self.logger.info(query)
        database.load_data_from_dataframe(df, query, 5000)

        self.logger.info('load gene-ko relationships')
        cols = ['gene', 'ko']
        query = get_create_relationships_query(NODE_KEGG, PROP_ID, 'gene', NODE_KO, PROP_ID, 'ko', 'HAS_KO')
        self.logger.info(query)
        database.load_csv_file(os.path.join(self.output_dir, 'gene2ko_data.tsv'), cols, query, 1, '\t', 5000)

        self.logger.info('load ko-pathway relationships')
        cols = ['ko', 'pathway']
        query = get_create_relationships_query(NODE_KO, PROP_ID, 'ko', NODE_PATHWAY, PROP_ID, 'pathway', 'IN_PATHWAY')
        self.logger.info(query)
        database.load_csv_file(os.path.join(self.output_dir, 'ko2pathway_data.tsv'), cols, query, 1, '\t', 5000,
                               ['pathway'])

        self.logger.info('load genome-pathway association')
        df = pd.read_csv(os.path.join(self.output_dir, 'genome2pathway_data.tsv'), sep='\t', dtype={'pathway': str})
        df[PROP_DATA_SOURCE] = 'KEGG'
        df_genome = df[['genome', PROP_DATA_SOURCE]].drop_duplicates()
        df_genome.columns = [PROP_ID, PROP_DATA_SOURCE]
        query = get_create_nodes_query(NODE_GENOME, PROP_ID, [PROP_DATA_SOURCE], [NODE_KEGG])
        self.logger.info(query)
        database.load_data_from_dataframe(df_genome, query, 5000)
        cols = ['genome', 'pathway']
        query = get_create_relationships_query(NODE_GENOME, PROP_ID, 'genome', NODE_PATHWAY, PROP_ID, 'pathway', REL_HAS_PATHWAY)
        self.logger.info(query)
        database.load_data_from_dataframe(df, query, 5000)


def main():
    database = get_database()
    loader = KeggDataLoader(get_data_dir())
    loader.create_indexes(database)
    loader.load_data_to_neo4j(database)
    database.close()

