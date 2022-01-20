import codecs
import logging
import os
import pandas as pd
import tarfile

from typing import List

from common.constants import *
from common.graph_models import NodeData
from biocyc import utils as biocyc_utils
from common.base_parser import BaseParser
from common.query_builder import *
from tarfile import TarFile

UNIQUE_ID = 'UNIQUE-ID'
NODE_LABEL = 'node_label'
LABEL = ':LABEL'


class BaseDataFileParser(BaseParser):
    """
    Base parser for Biocyc .dat files.
    """
    def __init__(
        self,
        prefix: str,
        base_dir: str,
        biocyc_dbname: str,
        tar_file: str,
        datafile_name: str,
        entity_name: str,
        attr_names: dict,
        rel_names: dict=None,
        db_link_sources: dict=None
    ):
        """
        :param base_data_dir: the data file base directory, that is the parent folder for 'download'
        :param biocyc_dbname: biocyc database name, eg. DB_ECOCYC, DB_HUMANCYC
        :param tar_file: tar file downloaded from biocyc website
        :param datafile_name: the data file name to process (in tar_file), e.g. genes.dat
        :param entity_name: The entity to process, e.g. Gene, Protein etc.
        :param attr_names: mapping for tagName and attrName
        :param rel_names:  mapping for tagName and relName
        :param db_link_sources:  mapping for tagName and linkRel
        """
        super().__init__(prefix, DB_BIOCYC.lower(), base_dir)
        self.input_zip = os.path.join(self.download_dir, tar_file)
        self.db_output_dir = os.path.join(self.output_dir, biocyc_dbname.lower())
        self.datafile = datafile_name
        self.node_labels = [NODE_BIOCYC, 'db_' + biocyc_dbname,  entity_name]
        self.entity_name = entity_name
        self.attr_name_map = attr_names
        self.rel_name_map = rel_names
        self.db_link_sources = db_link_sources
        self.attrs = []
        self.version = ''
        self.logger = logging.getLogger(__name__)
        self.nodes: List[NodeData] = []

    def create_synonym_rels(self)->bool:
        return False

    def get_db_version(self, tar: TarFile):
        """
        find the latest version of data in the tar file. Sometimes a tar file has multiple version data.
        :param tar:
        :return:
        """
        version = None
        for file in tar.getmembers():
            if '/data' in file.name:
                paths = file.name.split('/data')[0].split('/')
                curr_version = float(paths[-1])
                version = curr_version if version is None else max(version, curr_version)
        return str(version)

    def parse_data_file(self):
        self.logger.info(f'Opening {self.input_zip}')
        with tarfile.open(self.input_zip, mode='r:gz') as tar:
            if not self.version:
                self.version = self.get_db_version(tar)
                self.logger.info(f'Database file version: "{self.version}"')
            for tarinfo in tar:
                if tarinfo.name.endswith('/' + self.datafile) and self.version in tarinfo.name:
                    self.logger.info('Parse ' + tarinfo.name)
                    utf8reader = codecs.getreader('ISO-8859-1')
                    f = utf8reader(tar.extractfile(tarinfo.name))
                    node = None
                    prev_line_is_comment = False
                    for line in f:
                        line = biocyc_utils.cleanhtml(line)
                        node, prev_line_is_comment = self.parse_line(line, node, prev_line_is_comment)
                    break

    def parse_line(self, line, node, prev_line_is_comment):
        try:
            if line.startswith(UNIQUE_ID):
                node = NodeData(self.node_labels.copy(), PROP_BIOCYC_ID)
                self.nodes.append(node)

                # add data source property
                node.add_attribute(PROP_DATA_SOURCE, DB_BIOCYC, 'str')
            if node and PROP_COMMENT in self.attr_name_map and prev_line_is_comment and line.startswith('/'):
                line = line[1:].strip()
                node.add_attribute(PROP_COMMENT, line, 'str')
            elif node:
                attr, val = biocyc_utils.get_attr_val_from_line(line)
                if attr:
                    prev_line_is_comment = False if attr.lower() != PROP_COMMENT else True

                    if attr in self.attr_name_map:
                        prop_name, data_type = biocyc_utils.get_property_name_type(attr, self.attr_name_map)
                        node.add_attribute(prop_name, val, data_type)
                        if attr == UNIQUE_ID:
                            node.add_attribute(PROP_ID, val, data_type)

                    if self.rel_name_map and attr in self.rel_name_map:
                        # some rel could also be an attribute, e.g. types
                        if attr == 'DBLINKS':
                            tokens = val.split(' ')
                            if len(tokens) > 1:
                                db_name = tokens[0].lstrip('(')
                                reference_id = tokens[1].strip(')').strip('"')
                                self.add_dblink(node, db_name, reference_id)
                        else:
                            rel_type = self.rel_name_map.get(attr)
                            node.add_edge_type(rel_type, val)
        except Exception as ex:
            self.logger.error('line:', line)
        return node, prev_line_is_comment

    # TODO: move this elsewhere, also used in regulon_parser
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

    def parse_and_write_data_files(self):
        db_links = []
        entity_rels = []
        synonyms = []
        biocyc_nodes = []

        for node in self.nodes:
            biocyc_nodes.append(node.to_dict())

        for node in self.nodes:
            if self.create_synonym_rels():
                synonyms = [{
                    PROP_BIOCYC_ID: node.get_attribute(PROP_BIOCYC_ID),
                    PROP_NAME: syn
                } for syn in node.get_synonym_set()]

            for edge in node.edges:
                from_id = edge.source.get_attribute(edge.source.id_attr)
                to_id = edge.dest.get_attribute(edge.dest.id_attr)
                rel = edge.label
                if rel != REL_DBLINKS:
                    entity_rels.append({'relationship': rel, 'from_id': from_id, 'to_id': to_id})
                else:
                    if self.db_link_sources:
                        db_name = edge.dest.get_attribute(PROP_DB_NAME)
                        if db_name in self.db_link_sources:
                            db_links.append({
                                'node_label': f'db_{db_name}' if db_name != 'NCBI-GENE' else NODE_GENE,
                                'relationship': f'{db_name.upper()}_LINK' if db_name != 'NCBI-GENE' else REL_IS,
                                'from_id': from_id,
                                'to_id': to_id
                            })

        # NOTE: keeping the commented out query = get_... to know what queries to use
        # once they're in liquibase, can delete them

        if biocyc_nodes:
            outfilename = f'{self.file_prefix}{str(self)}-nodes.tsv'
            df = pd.DataFrame(biocyc_nodes, columns=self.attrs + [PROP_ID, PROP_DATA_SOURCE])
            df.fillna('', inplace=True)
            if PROP_NAME in df.columns:
                self._clean_characters(df, PROP_NAME)
            df.to_csv(os.path.join(self.output_dir, outfilename), index=False, sep='\t')
            # attrs = set(self.attrs + [PROP_ID, PROP_DATA_SOURCE]) - {'synonyms'}
            # query = get_create_update_nodes_query(NODE_BIOCYC, PROP_BIOCYC_ID, attrs, self.node_labels)

        if synonyms:
            outfilename = f'{self.file_prefix}{str(self)}-synonyms.tsv'
            df = pd.DataFrame(synonyms)
            if PROP_NAME in df.columns:
                self._clean_characters(df, PROP_NAME)
            df.to_csv(os.path.join(self.output_dir, outfilename), index=False, sep='\t')
            # # query = get_create_synonym_relationships_query(NODE_BIOCYC, PROP_BIOCYC_ID, PROP_BIOCYC_ID, PROP_NAME, [])

        if entity_rels:
            outfilename = f'{self.file_prefix}{str(self)}-node-rels.tsv'
            df = pd.DataFrame(entity_rels)
            df.to_csv(os.path.join(self.output_dir, outfilename), index=False, sep='\t')
            # # query = get_create_relationships_query(NODE_BIOCYC, PROP_BIOCYC_ID, 'from_id', NODE_BIOCYC, PROP_BIOCYC_ID, 'to_id', rel)

        if db_links:
            outfilename = f'{self.file_prefix}{str(self)}-node-db-rels.tsv'
            df = pd.DataFrame(db_links)
            df.to_csv(os.path.join(self.output_dir, outfilename), index=False, sep='\t')
            # # query = get_create_relationships_query(NODE_BIOCYC, PROP_BIOCYC_ID, 'from_id', dest_label, PROP_ID, 'to_id', rel)

    def add_dblink(self, node:NodeData, db_name, reference_id):
        link_node = NodeData(NODE_DBLINK, PROP_REF_ID)
        if reference_id.startswith(db_name):
            reference_id = reference_id[len(db_name)+1:]  # remove db prefix
        link_node.update_attribute(PROP_REF_ID, reference_id)
        link_node.update_attribute(PROP_DB_NAME, db_name)
        node.add_edge(node, link_node, REL_DBLINKS)

    # TODO: delete this once added to liquibase
    # def create_indexes(self, database):
    #     database.create_index(self.entity_name, PROP_ID, f"index_{self.entity_name.lower}_id")
    #     database.create_index(self.entity_name, PROP_BIOCYC_ID, f"index_{self.entity_name.lower}_biocycid")
    #     database.create_index(self.entity_name, PROP_NAME, f"index_{self.entity_name.lower}_name")
