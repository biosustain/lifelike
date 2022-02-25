from biocyc.base_data_file_parser import BaseDataFileParser
from common.constants import *
from common.graph_models import RelationshipType
from biocyc.utils import cleanhtml


ATTR_NAMES = {
    'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'ABBREV-NAME': (PROP_ABBREV_NAME, 'str'),
    'INCHI-KEY': (PROP_INCHI_KEY, 'str'),
    'INCHI': (PROP_INCHI, 'str'),
    'SMILES': (PROP_SMILES, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str')
}
REL_NAMES = {
    'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
    'DBLINKS': RelationshipType(REL_DBLINKS, 'to', NODE_DBLINK, PROP_REF_ID),
}

## format: key: source db name, value: (KEY-Index, KEY_with_DB_PREFIX), e.g. if KEY_with_DB_PREFIX == True, key will be like 'CHEBI:1234', otherwise, '1234'.
DB_LINK_SOURCES = {'CHEBI':True}

class CompoundParser(BaseDataFileParser):
    def __init__(self, prefix: str, db_name: str, tarfile: str, base_dir: str):
        super().__init__(prefix, base_dir, db_name, tarfile, 'compounds.dat', NODE_COMPOUND, ATTR_NAMES, REL_NAMES, DB_LINK_SOURCES)
        self.attrs = [PROP_BIOCYC_ID, PROP_NAME, PROP_ABBREV_NAME, PROP_INCHI_KEY]

    def __str__(self):
        return 'biocyc-compound'

    def create_synonym_rels(self) -> bool:
        return True

    def parse_and_write_data_files(self):
        for node in self.nodes:
            name = node.get_attribute(PROP_NAME)
            if name:
                # clean compound names
                name = cleanhtml(name)
                if name.startswith('a '):
                    name = name[2:]
                elif name.startswith('an '):
                    name = name[3:]
                node.update_attribute(PROP_NAME, name)

            inchi_key = node.get_attribute(PROP_INCHI_KEY)
            if inchi_key:
                node.update_attribute(PROP_INCHI_KEY, inchi_key[len('InChIKey='):])
        super().parse_and_write_data_files()
