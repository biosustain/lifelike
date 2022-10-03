from biocyc.parsers.data_file_parser import DataFileParser, UNIQUE_ID
from common.constants import *
from common.graph_models import NodeData
from biocyc import utils as biocyc_utils

ATTR_NAMES = {
    'UNIQUE-ID': (PROP_ID, 'str'),
    'TYPES': (PROP_TYPES, 'str'),
    'COMMON-NAME': (PROP_NAME, 'str'),
    'ABSTRACT': (PROP_ABSTRACT, 'str'),
    'AGRICOLA-ID': (PROP_AGRICOLA_ID, 'str'),
    'AUTHORS': (PROP_AUTHORS, 'str'),
    'COMMENT': (PROP_COMMENT, 'str'),
    'CREDITS': (PROP_CREDITS, 'str'),
    'DATA-SOURCE': (PROP_DATA_SOURCE, 'str'),
    'DOCUMENTATION': (PROP_DOCUMENTATION, 'str'),
    'DOI-ID': (PROP_DOI_ID, 'str'),
    # 'HIDE-SLOT': (PROP_HIDE_SLOT, 'str'),
    'INSTANCE-NAME-TEMPLATE': (PROP_INSTANCE_NAME_TEMPLATE, 'str'),
    'MEDLINE-UID': (PROP_MEDLINE_UID, 'str'),
    'MEMBER-SORT-FN': (PROP_MEMBER_SORT_FN, 'str'),
    'MESH-HEADINGS': (PROP_MESH_HEADINGS, 'str'),
    'PATHOLOGIC-NAME-MATCHER-EVIDENCE': (PROP_PATHOLOGIC_NAME_MATCHER_EVIDENCE, 'str'),
    'PATHOLOGIC-PWY-EVIDENCE': (PROP_PATHOLOGIC_PWY_EVIDENCE, 'str'),
    'PUBMED-ID': (PROP_PUBMED_ID, 'str'),
    'REFERENT-FRAME': (PROP_REFERENT_FRAME, 'str'),
    'SOURCE': (PROP_SOURCE, 'str'),
    'SYNONYMS': (PROP_SYNONYMS, 'str'),
    'TITLE': (PROP_TITLE, 'str'),
    'URL': (PROP_URL, 'str'),
    'YEAR': (PROP_YEAR, 'str')
}
REL_NAMES = {
}

class PublicationParser(DataFileParser):
    def __init__(self, biocyc_dbname, tarfile):
        DataFileParser.__init__(
            self, biocyc_dbname, tarfile, 'pubs.dat', NODE_PUBLICATION, ATTR_NAMES, REL_NAMES
        )
        self.attrs = [
            PROP_ID,
            PROP_TYPES,
            PROP_NAME,
            PROP_ABSTRACT,
            PROP_AGRICOLA_ID,
            PROP_AUTHORS,
            PROP_COMMENT,
            PROP_CREDITS,
            PROP_DATA_SOURCE,
            PROP_DOCUMENTATION,
            PROP_DOI_ID,
            PROP_INSTANCE_NAME_TEMPLATE,
            PROP_MEDLINE_UID,
            PROP_MEMBER_SORT_FN,
            PROP_MESH_HEADINGS,
            PROP_PATHOLOGIC_NAME_MATCHER_EVIDENCE,
            PROP_PATHOLOGIC_PWY_EVIDENCE,
            PROP_PUBMED_ID,
            PROP_REFERENT_FRAME,
            PROP_SOURCE,
            PROP_SYNONYMS,
            PROP_TITLE,
            PROP_URL,
            PROP_YEAR
        ]

    def parse_line(self, line, node, nodes):
        try:
            if line.startswith(UNIQUE_ID):
                node = NodeData(self.entity_name, PROP_ID)
                nodes.append(node)
            if node:
                attr, val = biocyc_utils.get_attr_val_from_line(line)
                if attr in self.attr_name_map:
                    prop_name, data_type = biocyc_utils.get_property_name_type(attr, self.attr_name_map)
                    node.add_attribute(prop_name, val, data_type)
                elif attr in self.rel_name_map:
                    # some rel could also be an attribute, e.g. types
                    if attr == 'DBLINKS':
                        tokens = val.split(' ')
                        if len(tokens) > 1:
                            db_name = tokens[0].lstrip('(')
                            reference_id = tokens[1].strip(')').strip('"')
                            self.add_dblink(node, db_name, reference_id )
                    else:
                        rel_type = self.rel_name_map.get(attr)
                        node.add_edge_type(rel_type, val)

        except Exception as ex:
            self.logger.error('line:', line)
        return node

    def parse_data_file(self):
        nodes = DataFileParser.parse_data_file(self)

        return nodes



