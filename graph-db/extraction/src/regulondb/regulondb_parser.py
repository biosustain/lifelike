import pandas as pd
import os, logging, re

from common.base_parser import BaseParser
from common.constants import *
# from common.query_builder import *
from common.database import get_create_update_nodes_query, get_create_relationships_query

REGULON_D_FILE = 'regulon_d_tmp.tsv'
REGULON_GENE_FILE = 'gene.tsv'
REGULON_OPERON_FILE = 'operon.tsv'
REGULON_PRODUCT_FILE = 'product.tsv'
REGULON_PROMOTER_FILE = 'promoter.tsv'
REGULON_TERMINATOR_FILE = 'terminator.tsv'
REGULON_TRANSCRIPTION_FACTOR_FILE = 'transcription_factor.tsv'
REGULON_TRANSCRIPTION_UNIT_FILE = 'transcription_unit.tsv'
REGULON_PROMOTOR_TRANSUNIT_REL_FILE = 'promoter_to_transcription_unit.tsv'
REGULON_OPERON_TRANSUNIT_REL_FILE = 'transcription_unit_to_operon.tsv'
REGULON_GENE_PRODUCT_REL_FILE = 'gene_product_link.tsv'
REGULON_REGULATES_REL_FILE = 'genetic_network.tsv'


class RegulonDbParser(BaseParser):
    def __init__(self, prefix: str, base_dir: str = None,):
        BaseParser.__init__(self, prefix, DB_REGULONDB.lower(), base_dir)
        self.download_dir = os.path.join(self.download_dir, 'txt')
        self.logger = logging.getLogger(__name__)

    def _pre_process_file(self, filename: str):
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

    def _get_dataframe_headers(self, col_headers: list, property_dict: dict):
        headers = []
        for col in col_headers:
            if property_dict and col in property_dict:
                headers.append(property_dict[col])
            else:
                headers.append(col)
        return headers

    # def create_index(self):
    #     self.database.create_constraint('db_RegulonDB', 'regulondb_id', 'constraint_regulondb_id')
    #     self.database.create_index('db_RegulonDB', 'name', 'index_regulondb_name')

    def _clean_characters(self, df, col: str):
        char_map = {
            r'&mdash;': '--',
            r'&quot;': '"',
            r'&deg;': '',
            r'(?i)&alpha;': 'alpha',
            r'(?i)&beta;': 'beta',
            r'(?i)&gamma;': 'gamma',
            r'(?i)&epsilon;': 'epsilon',
            r'(?i)&omega;': 'omega',
            r'(?i)&delta;': 'delta',
            r'(?i)&psi;': 'psi',
            r'(?i)&chi;': 'chi',
            r'(?i)&rho;': 'rho',
            r'(?i)&sigma;': 'sigma',
            r'(?i)&tau;': 'tau',
            r'(?i)&theta;': 'theta',
            r'&larr;': '<-',
            r'&rarr;': '->',
            r'(?i)<sub>|</sub>|<sup>|</sup>|<i>|</i>|<b>|</b>|<br>|</br>': ''
        }
        df[col].replace(char_map, inplace=True, regex=True)

    def process_file(self, filename: str, node_prop_map: dict):
        skiplines, headers = self._pre_process_file(filename)
        data_file = os.path.join(self.download_dir, filename)
        df_headers = self._get_dataframe_headers(headers, node_prop_map)
        df = pd.read_csv(data_file, delimiter='\t', names=df_headers, skiprows=skiplines)
        df = df.fillna('')
        return df[[v for _,v in node_prop_map.items()]]

    def create_nodes(self, node_label, node_prop_map: dict):
        properties = [val for val in node_prop_map.values()]
        query = get_create_update_nodes_query(NODE_REGULONDB, PROP_REGULONDB_ID, properties, [node_label])
        print(query)

    # def update_nodes(self, filename, node_label, node_prop_map: dict):
    #     skiplines, headers = self.pre_process_file(filename)
    #     data_file = os.path.join(self.download_dir, filename)
    #     df_headers = self._get_dataframe_headers(headers, node_prop_map)
    #     properties = [val for val in node_prop_map.values()]
    #     query = get_create_update_nodes_query(NODE_REGULONDB, PROP_REGULONDB_ID, properties, [node_label])
    #     self.database.load_csv_file(data_file, df_headers, query, skiplines)

    def create_edges(self, rel_type:str,  start_node_id_col, end_node_id_col, rel_property_map = None):
        rel_properties = []
        if rel_property_map:
            rel_properties = [val for val in rel_property_map.values()]
        query = get_create_relationships_query(NODE_REGULONDB, PROP_REGULONDB_ID, start_node_id_col, NODE_REGULONDB,
            PROP_REGULONDB_ID, end_node_id_col, rel_type, rel_properties)
        print(query)

    def load_genes(self):
        attribute_map = {
            'GENE_ID': PROP_REGULONDB_ID,
            'GENE_NAME': PROP_NAME,
            'GENE_POSLEFT': PROP_POS_LEFT,
            'GENE_POSRIGHT': PROP_POS_RIGHT,
            'GENE_STRAND': PROP_STRAND,
        }
        self.logger.info('Load regulondb genes')
        self.create_nodes(NODE_GENE, attribute_map)
        df = self.process_file('gene.txt', attribute_map)
        # some genes have an apostrophe at the end of the name
        # but regulondb does not have that apostrophe, so drop it
        df.loc[df.name.str[-1] == ("'"), PROP_NAME] = df.name.str[:-1]
        self._clean_characters(df, PROP_NAME)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + REGULON_GENE_FILE)
        df.to_csv(outfile, index=False, sep='\t')

    def load_operons(self):
        attribute_map = {
            'OPERON_ID': PROP_REGULONDB_ID,
            'OPERON_NAME': PROP_NAME,
            'REGULATIONPOSLEFT': PROP_POS_LEFT,
            'REGULATIONPOSRIGHT': PROP_POS_RIGHT,
            'OPERON_STRAND': PROP_STRAND,
        }
        self.logger.info('Load regulondb operons')
        self.create_nodes(NODE_OPERON, attribute_map)
        df = self.process_file('operon.txt', attribute_map)
        self._clean_characters(df, PROP_NAME)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + REGULON_OPERON_FILE)
        df.to_csv(outfile, index=False, sep='\t')

    def load_gene_products(self):
        attribute_map = {
            'PRODUCT_ID': PROP_REGULONDB_ID,
            'PRODUCT_NAME': PROP_NAME,
            'MOLECULAR_WEIGTH': PROP_MOLECULAR_WEIGHT,
            'LOCATION': PROP_LOCATION,
            # 'ANTICODON': 'anticodon',
            # 'PRODUCT_NOTE': PROP_COMMENT,
        }
        self.logger.info('Load regulondb products')
        self.create_nodes(NODE_PRODUCT, attribute_map)
        df = self.process_file('product.txt', attribute_map)
        # some genes have an apostrophe at the end of the name
        # but regulondb does not have that apostrophe, so drop it
        df.loc[df.name.str[-1] == ("'"), PROP_NAME] = df.name.str[:-1]
        self._clean_characters(df, PROP_NAME)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + REGULON_PRODUCT_FILE)
        df.to_csv(outfile, index=False, sep='\t')

    def load_promoters(self):
        attribute_map = {
            'PROMOTER_ID': PROP_REGULONDB_ID,
            'PROMOTER_NAME': PROP_NAME,
            'POS_1': PROP_POS_1,
            'SIGMA_FACTOR': PROP_SIGMA_FACTOR,
            'PROMOTER_SEQUENCE': PROP_SEQUENCE,
            'PROMOTER_STRAND': PROP_STRAND,
            # 'PROMOTER_NOTE': PROP_COMMENT,
        }
        self.logger.info('Load regulondb promoters')
        self.create_nodes(NODE_PROMOTER, attribute_map)
        df = self.process_file('promoter.txt', attribute_map)
        self._clean_characters(df, PROP_NAME)
        # there are two rows that was not parsed correctly and have html and links
        df.drop([1007,1008], inplace=True)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + REGULON_PROMOTER_FILE)
        df.to_csv(outfile, index=False, sep='\t')

    def load_regulons(self):
        attribute_map = {
            'REGULON_ID': PROP_REGULONDB_ID,
            'REGULON_NAME': PROP_NAME,
            'REGULON_TF_GROUP': PROP_NUM_TFS,
        }
        self.logger.info('Load regulondb regulons')
        self.create_nodes(NODE_REGULON, attribute_map)
        df = self.process_file('regulon_d_tmp.txt', attribute_map)
        self._clean_characters(df, PROP_NAME)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + REGULON_D_FILE)
        df.to_csv(outfile, index=False, sep='\t')

    def load_terminators(self):
        attribute_map = {
            'TERMINATOR_ID': PROP_REGULONDB_ID,
            'TERMINATOR_POSLEFT': PROP_POS_LEFT,
            'TERMINATOR_POSRIGHT': PROP_POS_RIGHT,
            'TERMINATOR_CLASS': PROP_TERMINATOR_CLASS,
            'TERMINATOR_SEQUENCE': PROP_SEQUENCE,
        }
        self.logger.info('Load regulondb terminators')
        self.create_nodes(NODE_TERMINATOR, attribute_map)
        df = self.process_file('terminator.txt', attribute_map)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + REGULON_TERMINATOR_FILE)
        df.to_csv(outfile, index=False, sep='\t')

    def load_transcription_factors(self):
        attribute_map = {
            'TRANSCRIPTION_FACTOR_ID': PROP_REGULONDB_ID,
            'TRANSCRIPTION_FACTOR_NAME': PROP_NAME,
            # 'SITE_LENGTH': 'site_length',
            # 'SYMMETRY': 'symmetry',
            'TRANSCRIPTION_FACTOR_FAMILY': PROP_REGULATORY_FAMILY,
            # 'TRANSCRIPTION_FACTOR_NOTE': PROP_COMMENT,
            # 'CONNECTIVITY_CLASS': 'connectivity_class',
            # 'SENSING_CLASS': 'sensing_class',
            # 'CONSENSUS_SEQUENCE': 'consensus_sequence',
        }
        self.logger.info('Load transcription_factors')
        self.create_nodes(NODE_TRANS_FACTOR, attribute_map)
        df = self.process_file('transcription_factor.txt', attribute_map)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + REGULON_TRANSCRIPTION_FACTOR_FILE)
        df.to_csv(outfile, index=False, sep='\t')

    def load_transunits(self):
        attribute_map = {
            'TRANSCRIPTION_UNIT_ID': PROP_REGULONDB_ID,
            'TRANSCRIPTION_UNIT_NAME': PROP_NAME,
            'TRANSCRIPTION_UNIT_NOTE': PROP_COMMENT,
        }
        self.logger.info('Load regulondb transcription_units')
        self.create_nodes(NODE_TRANS_UNIT, attribute_map)
        df = self.process_file('transcription_unit.txt', attribute_map)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + REGULON_TRANSCRIPTION_UNIT_FILE)
        self._clean_characters(df, PROP_NAME)
        self._clean_characters(df, PROP_COMMENT)
        df.to_csv(outfile, index=False, sep='\t')

        promoter_transunit_map = {
            'PROMOTER_ID': 'promoter_id',
            'TRANSCRIPTION_UNIT_ID': 'transcription_unit_id'
        }
        transunit_operon_map = {
            'OPERON_ID': 'operon_id',
            'TRANSCRIPTION_UNIT_ID': 'transcription_unit_id'
        }

        self.create_edges(REL_IS_ELEMENT, 'promoter_id', 'transcription_unit_id')
        df = self.process_file('transcription_unit.txt', promoter_transunit_map)
        # if a transcription unit doesn't have a promoter then drop it
        df = df.loc[df.promoter_id != '']
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + REGULON_PROMOTOR_TRANSUNIT_REL_FILE)
        df.to_csv(outfile, index=False, sep='\t')

        self.create_edges(REL_IS_ELEMENT, 'transcription_unit_id', 'operon_id')
        df = self.process_file('transcription_unit.txt', transunit_operon_map)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + REGULON_OPERON_TRANSUNIT_REL_FILE)
        df.to_csv(outfile, index=False, sep='\t')

    def map_gene_product_link(self):
        """ associate gene with product, return list of edges"""
        gene_product_map = {
            'GENE_ID': 'gene_id',
            'PRODUCT_ID': 'product_id'
        }
        self.logger.info("Associate gene with pruduct")
        self.create_edges(REL_ENCODE, 'gene_id', 'product_id')
        df = self.process_file('gene_product_link.txt', gene_product_map)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + REGULON_GENE_PRODUCT_REL_FILE)
        df.to_csv(outfile, index=False, sep='\t')

    def map_product_tf_link(self) -> []:
        """ associate transcription factors with gene products"""
        self.logger.info('Associate trans factors with products')
        self.create_edges('product_tf_link.txt', REL_IS_COMPONENT, 'PRODUCT_ID', 'TRANSCRIPTION_FACTOR_ID')

    def map_regulon_tf_link(self) -> []:
        """ associate transcription factors with regulons"""
        self.logger.info('Associate trans factors with regulons')
        self.create_edges('regulon_tf_link_tmp.txt', REL_IS_COMPONENT, 'TRANSCRIPTION_FACTOR_ID', 'REGULON_ID')

    def map_tu_gene_link(self) -> []:
        """ associate genes with transcription units"""
        self.logger.info("Associate genes with trans units")
        self.create_edges('tu_gene_link.txt', REL_IS_ELEMENT, 'GENE_ID', 'TRANSCRIPTION_UNIT_ID')

    def map_tu_terminator_link(self) -> []:
        """ associate terminators with transcription units """
        self.logger.info("Associate terminators with trans units")
        self.create_edges('tu_terminator_link.txt', REL_IS_ELEMENT, 'TERMINATOR_ID', 'TRANSCRIPTION_UNIT_ID')

    def map_genetic_network(self):
        """ associate regulator and regulated entities.  regulators are tf or sigma, ignore sigma for now"""
        self.logger.info("Associate regulator with regulatged")
        attr_map = {
            'FUNCTION_INTERACTION': 'function',
            'EVIDENCE': 'evidence',
            'REGULATOR_ID': 'regulator_id',
            'REGULATED_ID': 'regulated_id'
        }
        self.create_edges(REL_REGULATE, 'regulator_id', 'regulated_id', attr_map)
        df = self.process_file('genetic_network.txt', attr_map)
        outfile = os.path.join(self.output_dir, f'{self.file_prefix}' + REGULON_REGULATES_REL_FILE)
        df.to_csv(outfile, index=False, sep='\t')

    def map_regulon_promoter_link(self) -> []:
        self.logger.info('Associate regulon with promoter')
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
        self.logger.info('Relationship count: ' + str(len(df)))
        rel_properties = [val for val in rel_property_map.values()]
        query = get_create_relationships_query(NODE_REGULONDB, PROP_REGULONDB_ID, 'REGULON_ID',
                                                  NODE_REGULONDB, PROP_REGULONDB_ID, 'PROMOTER_ID', REL_REGULATE,
                                                  rel_properties)
        self.database.load_data_from_dataframe(query, df)

    def parse_and_load_data(self):
        # # self.create_index()
        # self.load_genes()
        # self.load_gene_products()
        # self.load_operons()
        # self.load_promoters()
        # self.load_regulons()
        # self.load_terminators()
        # self.load_transcription_factors()
        # self.load_transunits()

        # self.map_gene_product_link()
        # self.map_genetic_network()
        self.map_product_tf_link()
        # self.map_regulon_promoter_link()
        # self.map_regulon_tf_link()
        # self.map_tu_gene_link()
        # self.map_tu_terminator_link()

    def write_gene2bnumber(self):
        with open(os.path.join(self.download_dir, 'object_synonym.txt'), 'r') as f, open(os.path.join(self.output_dir, 'gene2bnumber.tsv'), 'w') as outfile:
            for line in f:
                if line.startswith('#'):
                    continue
                row = line.split('\t')
                if re.match(r'^b(\d)+$', row[1]):
                    outfile.write(f'{row[0]}\t{row[1]}\n')

    def associate_genes_with_NCBI(self):
        self.logger.info('Link regulondb genes with ncbi genes')
        file = os.path.join(self.output_dir, 'gene2bnumber.tsv')
        query = get_create_relationships_query(NODE_REGULONDB, PROP_REGULONDB_ID, PROP_REGULONDB_ID,
                                                        NODE_GENE, PROP_LOCUS_TAG, PROP_LOCUS_TAG, REL_IS)
        self.database.load_csv_file(file, [PROP_REGULONDB_ID, PROP_LOCUS_TAG], query)

    def set_id_prperty(self):
        query = "match (n:db_RegulonDB) set n.eid = n.regulondb_id"
        self.database.run_query(query)

    def add_name_property_as_synonym(self):
        self.logger.info('Add name as synonyms')
        # self.database.create_index(NODE_SYNONYM, PROP_NAME)
        query = "match (n:db_RegulonDB) where exists(n.name) with n merge (s:Synonym {name:n.name}) merge (n)-[:HAS_SYNONYM]->(s)"
        self.database.run_query(query)

    def add_gene_properties_for_enrichment(self):
        self.logger.info('Populate properties for enrichment')
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


def main(args):
    parser = RegulonDbParser(args.prefix)
    parser.parse_and_load_data()
    # parser.write_gene2bnumber()
    # parser.associate_genes_with_NCBI()
    # parser.add_name_property_as_synonym()
    # parser.add_gene_properties_for_enrichment()
