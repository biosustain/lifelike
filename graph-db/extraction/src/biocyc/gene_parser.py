from biocyc.base_data_file_parser import BaseDataFileParser
from common.graph_models import RelationshipType
from common.constants import *

ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'ACCESSION-1': (PROP_ACCESSION, 'str'),
    'LEFT-END-POSITION': (PROP_POS_LEFT, 'str'),
    'RIGHT-END-POSITION': (PROP_POS_RIGHT, 'str'),
    'TRANSCRIPTION-DIRECTION':(PROP_STRAND, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str')
}
REL_NAMES = {
    'DBLINKS': RelationshipType(REL_DBLINKS, 'to', NODE_DBLINK, PROP_REF_ID),
    # 'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
    # 'PRODUCT': RelationshipType(REL_ENCODE, 'to', NODE_PROTEIN, PROP_BIOCYC_ID),
}
DB_LINK_SOURCES = {'NCBI-GENE':False}


class GeneParser(BaseDataFileParser):
    def __init__(self, prefix: str, db_name: str, tarfile: str, base_dir: str):
        super().__init__(prefix, base_dir,  db_name, tarfile, 'genes.dat', NODE_GENE,ATTR_NAMES, REL_NAMES, DB_LINK_SOURCES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_ACCESSION, PROP_POS_LEFT, PROP_POS_RIGHT,PROP_STRAND]

    def __str__(self):
        return 'biocyc-gene'

    def create_synonym_rels(self) -> bool:
        return True

    # TODO: remove after adding to liquibase
    # def create_indexes(self, database: Database):
    #     BaseDataFileParser.create_indexes(database)
    #     database.create_index(NODE_GENE, PROP_ACCESSION, 'index_gene_accession')
