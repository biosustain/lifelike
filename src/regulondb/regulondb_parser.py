from common.base_parser import BaseParser
from common.constants import *
from common.database import *
from common.query_builder import *
import pandas as pd
import os, logging, re

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])


class RegulonDbParser(BaseParser):
    def __init__(self, database:Database, base_dir: str = None,):
        BaseParser.__init__(self, DB_REGULONDB.lower(), base_dir)
        self.download_dir = os.path.join(self.download_dir, 'txt')
        self.database = database

    def pre_process_file(self, filename):
        """
        Read text file and return num of skip lines and headers
        :param filename: text file name
        :return: skiplines (int), headers([])
        """
        skiplines = 0
        headers = []
        with open(os.path.join(self.download_dir, filename), 'r') as f:
            start = False
            for line in f:
                if 'Columns:' in line:
                    start = True
                elif start and line.startswith('#'):
                    colname = line[5:].strip()
                    headers.append(colname)
                elif start:
                    break
                skiplines += 1
        return skiplines, headers

    def _get_dataframe_headers(self, col_headers:[], property_dict:dict):
        headers = list()
        for col in col_headers:
            if property_dict and col in property_dict:
                headers.append(property_dict[col])
            else:
                headers.append(col)
        return headers

    def create_nodes(self, filename, node_label, node_prop_map: dict):
        skiplines, headers = self.pre_process_file(filename)
        data_file = os.path.join(self.download_dir, filename)
        df_headers = self._get_dataframe_headers(headers, node_prop_map)
        properties = [val for val in node_prop_map.values()]
        query = get_create_nodes_query(NODE_REGULONDB, PROP_REGULONDB_ID, properties, [node_label])
        self.database.load_csv_file(data_file, df_headers, query, skiplines)

    def update_nodes(self, filename, node_label, node_prop_map: dict):
        skiplines, headers = self.pre_process_file(filename)
        data_file = os.path.join(self.download_dir, filename)
        df_headers = self._get_dataframe_headers(headers, node_prop_map)
        properties = [val for val in node_prop_map.values()]
        query = get_update_nodes_query(NODE_REGULONDB, PROP_REGULONDB_ID, properties, [node_label])
        self.database.load_csv_file(data_file, df_headers, query, skiplines)

    def create_edges(self, filename, rel_type:str,  start_node_id_col, end_node_id_col, rel_property_map = None):
        skiplines, headers = self.pre_process_file(filename)
        df_headers = self._get_dataframe_headers(headers, rel_property_map)
        data_file = os.path.join(self.download_dir, filename)
        df = pd.read_csv(data_file, sep='\t', header=None, names=df_headers, skiprows=skiplines,
                         index_col=False, low_memory=False, engine='c')
        logging.info('relationship count: ' + str(len(df)))
        rel_properties = []
        if rel_property_map:
            rel_properties = [val for val in rel_property_map.values()]
        query = get_create_relationships_query(NODE_REGULONDB, PROP_REGULONDB_ID, start_node_id_col,
                                               NODE_REGULONDB, PROP_REGULONDB_ID, end_node_id_col, rel_type, rel_properties)
        # print(query)
        self.database.load_data_from_dataframe(df, query)

    def load_genes(self):
        attribute_map = {
            'GENE_ID': PROP_REGULONDB_ID,
            'GENE_NAME': PROP_COMMON_NAME, 
            'GENE_POSLEFT': PROP_POS_LEFT,
            'GENE_POSRIGHT': PROP_POS_RIGHT,
            'GENE_STRAND': PROP_STRAND,
        }
        logging.info ('load regulondb genes')
        self.create_nodes('gene.txt', NODE_GENE, attribute_map)

    def load_operons(self):
        attribute_map = {
            'OPERON_ID': PROP_REGULONDB_ID,
            'OPERON_NAME': PROP_COMMON_NAME,
            'REGULATIONPOSLEFT': PROP_POS_LEFT,
            'REGULATIONPOSRIGHT': PROP_POS_RIGHT,
            'OPERON_STRAND': PROP_STRAND,
        }
        logging.info('load regulondb operons')
        self.create_nodes('operon.txt', NODE_OPERON, attribute_map)

    def load_gene_products(self):
        attribute_map = {
            'PRODUCT_ID': PROP_REGULONDB_ID,
            'PRODUCT_NAME': PROP_COMMON_NAME,
            'MOLECULAR_WEIGTH': 'molecular_weight',
            'LOCATION': 'location',
            # 'ANTICODON': 'anticodon',
            # 'PRODUCT_NOTE': PROP_COMMENT,
        }
        logging.info('load regulondb products')
        self.create_nodes('product.txt', NODE_PRODUCT, attribute_map)

    def load_promoters(self):
        attribute_map = {
            'PROMOTER_ID': PROP_REGULONDB_ID,
            'PROMOTER_NAME': PROP_COMMON_NAME,
            'POS_1': PROP_POS_1,
            'SIGMA_FACTOR': 'sigma_factor',
            'PROMOTER_SEQUENCE': PROP_SEQUENCE,
            'PROMOTER_STRAND': PROP_STRAND,
            # 'PROMOTER_NOTE': PROP_COMMENT,
        }
        logging.info('load regulondb promoters')
        self.create_nodes('promoter.txt', NODE_PROMOTER, attribute_map)

    def load_regulons(self):
        attribute_map = {
            'REGULON_ID': PROP_REGULONDB_ID,
            'REGULON_NAME': PROP_COMMON_NAME,
            'REGULON_TF_GROUP': 'num_tfs',
        }
        logging.info('load regulondb regulons')
        self.create_nodes('regulon_d_tmp.txt', NODE_REGULON, attribute_map)


    def load_terminators(self):
        attribute_map = {
            'TERMINATOR_ID': PROP_REGULONDB_ID,
            'TERMINATOR_POSLEFT': PROP_POS_LEFT,
            'TERMINATOR_POSRIGHT': PROP_POS_RIGHT,
            'TERMINATOR_CLASS': 'terminator_class',
            'TERMINATOR_SEQUENCE': 'sequence',
        }
        logging.info('load regulondb terminators')
        self.create_nodes('terminator.txt', NODE_TERMINATOR, attribute_map)

    def load_transunits(self):
        attribute_map = {
            'TRANSCRIPTION_UNIT_ID': PROP_REGULONDB_ID,
            'TRANSCRIPTION_UNIT_NAME': PROP_COMMON_NAME,
            'TRANSCRIPTION_UNIT_NOTE': PROP_COMMENT,
        }
        logging.info('load regulondb transcription_units')
        self.create_nodes('transcription_unit.txt', NODE_TRANS_UNIT, attribute_map)
        self.create_edges('transcription_unit.txt', REL_IS_ELEMENT, 'PROMOTER_ID', 'TRANSCRIPTION_UNIT_ID')
        self.create_edges('transcription_unit.txt', REL_IS_ELEMENT, 'TRANSCRIPTION_UNIT_ID', 'OPERON_ID')

    def load_transcription_factors(self, update=False):
        attribute_map = {
            'TRANSCRIPTION_FACTOR_ID': PROP_REGULONDB_ID,
            'TRANSCRIPTION_FACTOR_NAME': PROP_COMMON_NAME,
            'SITE_LENGTH': 'site_length',
            'SYMMETRY': 'symmetry',
            'TRANSCRIPTION_FACTOR_FAMILY': 'regulator_family',
            # 'TRANSCRIPTION_FACTOR_NOTE': PROP_COMMENT,
            'CONNECTIVITY_CLASS': 'connectivity_class',
            'SENSING_CLASS': 'sensing_class',
            'CONSENSUS_SEQUENCE': 'consensus_sequence',
        }
        logging.info('load transcription_factors')
        if update:
            self.update_nodes('transcription_factor.txt', NODE_TRANS_FACTOR, attribute_map)
        else:
            self.create_nodes('transcription_factor.txt', NODE_TRANS_FACTOR, attribute_map)

    def map_gene_product_link(self) -> []:
        """ associate gene with product, return list of edges"""
        logging.info("associate gene with pruduct")
        self.create_edges('gene_product_link.txt', REL_ENCODE, 'GENE_ID', 'PRODUCT_ID')

    def map_product_tf_link(self) -> []:
        """ associate transcription factors with gene products"""
        logging.info('associate trans factors with products')
        self.create_edges('product_tf_link.txt', REL_IS_COMPONENT, 'PRODUCT_ID', 'TRANSCRIPTION_FACTOR_ID')

    def map_regulon_tf_link(self) -> []:
        """ associate transcription factors with regulons"""
        logging.info('associate trans factors with regulons')
        self.create_edges('regulon_tf_link_tmp.txt', REL_IS_COMPONENT, 'TRANSCRIPTION_FACTOR_ID', 'REGULON_ID')

    def map_tu_gene_link(self) -> []:
        """ associate genes with transcription units"""
        logging.info("associate genes with trans units")
        self.create_edges('tu_gene_link.txt', REL_IS_ELEMENT, 'GENE_ID', 'TRANSCRIPTION_UNIT_ID')

    def map_tu_terminator_link(self) -> []:
        """ associate terminators with transcription units """
        logging.info("associate terminators with trans units")
        self.create_edges('tu_terminator_link.txt', REL_IS_ELEMENT, 'TERMINATOR_ID', 'TRANSCRIPTION_UNIT_ID')

    def map_genetic_network(self) -> []:
        """ associate regulator and regulated entities.  regulators are tf or sigma, ignore sigma for now"""
        logging.info("associate regulator with regulatged")
        attr_map = {
            'FUNCTION_INTERACTION': PROP_FUNCTION,
            'EVIDENCE': 'eveidence',
        }
        self.create_edges('genetic_network.txt', REL_REGULATE, 'REGULATOR_ID', 'REGULATED_ID', attr_map)

    def map_regulon_promoter_link(self) -> []:
        logging.info('associate regulon with promoter')
        file1 = os.path.join(self.download_dir, 'regulonfuncpromoter_link_tmp.txt')
        skiplines, headers = self.pre_process_file(file1)
        df1 = pd.read_csv(file1, sep='\t', header=None, names=headers, skiprows=skiplines,
                         index_col=False, low_memory=False, engine='c')

        file2 = os.path.join(self.download_dir, 'regulon_function_tmp.txt')
        skiplines, headers = self.pre_process_file(file2)
        df2 = pd.read_csv(file2, sep='\t', header=None, names=headers, skiprows=skiplines,
                         index_col=False, low_memory=False, engine='c')
        df = df1.merge(df2, on='REGULON_FUNCTION_ID')
        rel_property_map = {
            'REGULON_FUNCTION_NAME': PROP_FUNCTION
        }
        logging.info('relationship count: ' + str(len(df)))
        rel_properties = [val for val in rel_property_map.values()]
        query = get_create_relationships_query(NODE_REGULONDB, PROP_REGULONDB_ID, 'REGULON_ID',
                                                  NODE_REGULONDB, PROP_REGULONDB_ID, 'PROMOTER_ID', REL_REGULATE,
                                                  rel_properties)
        self.database.load_data_from_dataframe(df, query)

    def parse_and_load_data(self):
        # self.database.create_constraint(NODE_REGULONDB, PROP_REGULONDB_ID)
        self.load_genes()
        self.load_gene_products()
        self.load_operons()
        self.load_promoters()
        self.load_regulons()
        self.load_terminators()
        self.load_transcription_factors()
        self.load_transunits()

        self.map_gene_product_link()
        self.map_genetic_network()
        self.map_product_tf_link()
        self.map_regulon_promoter_link()
        self.map_regulon_tf_link()
        self.map_tu_gene_link()
        self.map_tu_terminator_link()

    def write_gene2bnumber(self):
        with open(os.path.join(self.download_dir, 'object_synonym.txt'), 'r') as f, open(os.path.join(self.output_dir, 'gene2bnumber.tsv'), 'w') as outfile:
            for line in f:
                if line.startswith('#'):
                    continue
                row = line.split('\t')
                if re.match(r'^b(\d)+$', row[1]):
                    outfile.write(f'{row[0]}\t{row[1]}\n')

    def associate_genes_with_NCBI(self):
        logging.info('link regulondb genes with ncbi genes')
        file = os.path.join(self.output_dir, 'gene2bnumber.tsv')
        query = get_create_relationships_query(NODE_REGULONDB, PROP_REGULONDB_ID, PROP_REGULONDB_ID,
                                                        NODE_GENE, PROP_LOCUS_TAG, PROP_LOCUS_TAG, REL_IS)
        self.database.load_csv_file(file, [PROP_REGULONDB_ID, PROP_LOCUS_TAG], query)

    def set_id_prperty(self):
        query = "match (n:db_RegulonDB) set n.id = n.regulondb_id"
        self.database.run_query(query)

    def add_name_property_as_synonym(self):
        logging.info('add name as synonyms')
        # self.database.create_index(NODE_SYNONYM, PROP_NAME)
        query = "match (n:db_RegulonDB) where exists(n.name) with n merge (s:Synonym {name:n.name}) merge (n)-[:HAS_SYNONYM]->(s)"
        self.database.run_query(query)

    def add_gene_properties_for_enrichment(self):
        logging.info('populate properties for enrichment')
        query = """
        match (n:Gene:db_RegulonDB)-[:ENCODES]-(p)-[]-(t:TranscriptionFactor) 
        set n.regulator_family = t.regulator_family
        """
        self.database.run_query(query)

        query = """
        match (n:Gene:db_RegulonDB)-[r:REGULATES]-(t) where r.function = '+'
        with n, collect(t.name) as regulators
        set n.activated_by = regulators
        """
        self.database.run_query(query)

        query = """
        match (n:Gene:db_RegulonDB)-[r:REGULATES]-(t) where r.function = '-'
        with n, collect(t.name) as regulators
        set n.repressed_by = regulators
        """
        self.database.run_query(query)


if __name__ == '__main__':
    database = get_database(Neo4jInstance.LOCAL, 'neo4j')
    parser = RegulonDbParser(database)
    parser.parse_and_load_data()
    parser.write_gene2bnumber()
    parser.associate_genes_with_NCBI()
    parser.add_name_property_as_synonym()
    parser.add_gene_properties_for_enrichment()
    database.close()
