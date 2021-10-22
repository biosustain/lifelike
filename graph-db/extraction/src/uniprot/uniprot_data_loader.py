from common.base_data_loader import BaseDataLoader
from common.constants import *
from common.database import *


class UniprotDataLoader(BaseDataLoader):
    def __init__(self, basedir):
        BaseDataLoader.__init__(self, DB_UNIPROT.lower(), basedir)
        self.logger = logging.getLogger(__name__)

    def create_indexes(self, database: Database):
        database.create_constraint(NODE_UNIPROT, PROP_ID, 'constraint_uniprot_id')
        database.create_index(NODE_UNIPROT, PROP_NAME, 'index_uniprot_name')
        database.create_index(NODE_PROTEIN, PROP_NAME, 'index_protein_name')
        database.create_constraint(NODE_SYNONYM, PROP_NAME, 'constraint_synonym_name')

    def load_data_to_neo4j(self, database: Database):
        self._load_protein_gene_links_to_neo4j(database)
        self._load_protein_synonym_links_to_neo4j(database)
        self._load_protein_go_links_to_neo4j(database)
        self._load_protein_gene_links_to_neo4j(database)
        self._load_protein_tax_links_to_neo4j(database)

    def _load_proteins_to_neo4j(self, database):
        self.logger.info('load uniprot proteins')
        cols = [PROP_ID, PROP_NAME, PROP_GENE_NAME, PROP_TAX_ID, PROP_PATHWAY, PROP_FUNCTION]
        query = get_create_update_nodes_query(NODE_UNIPROT, PROP_ID, cols, [NODE_PROTEIN], datasource=DB_UNIPROT, original_entity_type=NODE_PROTEIN)
        database.load_csv_file(query, os.path.join(self.output_dir, 'sprot.tsv'), dtype={PROP_TAX_ID, str}, chunksize=5000)

    def _load_protein_synonym_links_to_neo4j(self, database):
        self.logger.info('load protein-synonym relationships')
        query = get_create_synonym_relationships_query(NODE_UNIPROT, PROP_ID, PROP_ID, PROP_NAME, [PROP_TYPE])
        database.load_csv_file(query, os.path.join(self.output_dir, 'sprot2syn.tsv'), chunksize=5000)
        database.load_csv_file(query, os.path.join(self.output_dir, 'sprot2syn_derived.tsv'), chunksize=5000)

        # add protein id and name as synonym
        query = """
        match (n:db_UniProt) merge (s1:Synonym {name:n.name}) merge(s2:Synonym {name:n.id})
        merge (n)-[:HAS_SYNONYM]->(s1)
        merge (n)-[:HAS_SYNONYM]->(s2)
        """
        database.run_query(query)

    def _load_protein_go_links_to_neo4j(self, database):
        self.logger.info('load protein-go relationships')
        query = get_create_relationships_query(NODE_UNIPROT, PROP_ID, PROP_ID, NODE_GO, PROP_ID, PROP_GO_ID)
        database.load_csv_file(query, os.path.join(self.output_dir, 'sprot2go.tsv'), dtype={PROP_GO_ID, str}, chunksize=5000)

    def _load_protein_gene_links_to_neo4j(self, database):
        query = get_create_relationships_query(NODE_UNIPROT, PROP_ID, PROP_ID, NODE_GENE, PROP_ID, PROP_GENE_ID)
        database.load_csv_file(query, os.path.join(self.output_dir, 'sprot2gene2.tsv'), dtype={PROP_GENE_ID, str},
                               chunksize=5000)

    def _load_protein_tax_links_to_neo4j(self, database):
        query = f"""
        match(n:{NODE_UNIPROT}), (t:{NODE_TAXONOMY} {{id: n.tax_id}}) merge (n)-[:{REL_TAXONOMY}]->(t)
        """
        print(query)
        database.run_query(query)


