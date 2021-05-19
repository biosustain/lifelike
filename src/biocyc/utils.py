from common.graph_models import *
import re

BIOCYC_ATTR_NAMES = {'ABBREV-NAME': (),
                     'ABS-CENTER-POS': ('', 'number'),
                     'ABSOLUTE-PLUS-1-POS': ('', 'int'),
                     'ABSTRACT': (),
                     'ACCESSION-1': (PROP_ACCESSION, 'str'),
                     'ACCESSION-2': (),
                     'ALTERNATE-SEQUENCE': (),
                     'ANTI-ANTITERM-END-POS': ('', 'int'),
                     'ANTI-ANTITERM-START-POS': ('', 'int'),
                     'ANTICODON': (),
                     'ANTITERMINATOR-END-POS': ('', 'int'),
                     'ANTITERMINATOR-START-POS': ('', 'int'),
                     'ATOM-CHARGES': (),
                     'ATOM-MAPPINGS': (),
                     'ATTACHED-GROUP': (),
                     'AUTHORS': (),
                     'CATALYTIC-ACTIVITY': (),
                     # 'CENTISOME-POSITION': ('', 'number'),
                     'CHARGE': (),
                     'CHEMICAL-FORMULA': (),
                     'CODING-SEGMENTS': (),
                     'COMMENT': (),
                     'COMMON-NAME': (),
                     'COMPONENT-COEFFICIENTS': (),
                     'CONSENSUS-SEQUENCE': (),
                     'COPY-NUMBER': (),
                     'CREDITS': (),
                     'DATA-SOURCE': (),
                     'DELTAG0': (),
                     'DIAGRAM-INFO': (),
                     'DNA-FOOTPRINT-SIZE': (),
                     'EC-NUMBER': (PROP_EC_NUMBER, 'str'),
                     # 'ENGINEERED?': (),
                     'INCHI': (),
                     'INCHI-KEY': (),
                     'LEFT-END-POSITION': (PROP_POS_LEFT, 'int'),
                     'LOCATIONS': (),
                     'MECHANISM': (),
                     'MEDLINE-UID': (),
                     'MODE': (),
                     'NCBI-TAXONOMY-ID': (),
                     'RATE-LIMITING-STEP': (),
                     'REACTION-DIRECTION': (),
                     'REACTION-LAYOUT': (),
                     'RIGHT-END-POSITION': (PROP_POS_RIGHT, 'int'),
                     'RXN-LOCATIONS': (),
                     'SEQUENCE-SOURCE': (),
                     'SIGNAL': (),
                     'SITE-LENGTH': ('', 'int'),
                     'SMILES': (),
                     'SOURCE': (),
                     'SPECIFIC-ACTIVITY': (),
                     'SPLICE-FORM-INTRONS': (),
                     'SPONTANEOUS?': ('spontaneous', None),
                     'STRAIN-NAME': (),
                     'SYMMETRY': (),
                     'SYNONYMS': (PROP_SYNONYMS, 'str'),
                     'SYSTEMATIC-NAME': (),
                     'TITLE': (),
                     'TYPES': (),
                     'TRANSCRIPTION-DIRECTION': (),
                     'UNIQUE-ID': (PROP_BIOCYC_ID, 'str'),
                     'URL': (),
                     'YEAR': ('', 'int'), }

BIOCYC_REL_NAMES = {
                    # 'ACTIVATORS': RelationshipType(REL_ACTIVATORS, 'to', None, PROP_BIOCYC_ID),
                    # # 'ALTERNATIVE-COFACTORS': RelationshipType(),
                    # # 'ALTERNATIVE-SUBSTRATES': RelationshipType(),
                    # 'ASSOCIATED-BINDING-SITE': RelationshipType(REL_BIND, 'to', NODE_DNA_BINDING_SITE),
                    # # 'CATALYZES': RelationshipType(),
                    # # 'CITATIONS': RelationshipType(REL_CITATIONS, 'to', NODE_CITATION),
                    # # 'COFACTORS': RelationshipType(REL_COFACTORS, 'to', NODE_COMPOUND, PROP_BIOCYC_ID),
                    'COFACTORS-OF': RelationshipType(REL_COFACTORS, 'from', None, PROP_BIOCYC_ID),
                    'COMPONENT-OF': RelationshipType(REL_HAS_COMPONENT, 'from', None, PROP_BIOCYC_ID),
                    # # 'COMPONENTS': RelationshipType(),
                    # # 'DBLINKS': RelationshipType(REL_DBLINKS, 'to', NODE_DBLINK, PROP_REF_ID),
                    # 'EC-NUMBER': RelationshipType(REL_EC_NUMBER, 'to', NODE_EC_NUMBER, PROP_EC_NUMBER),
                    # 'ENZRXN-IN-PATHWAY': RelationshipType(REL_CONTAINS, 'from', NODE_PATHWAY, PROP_BIOCYC_ID),
                    # # 'ENZRXNS': RelationshipType(),
                    # # 'ENZYMATIC-REACTION': RelationshipType(),
                    'ENZYME': RelationshipType(REL_CATALYZE, 'from', NODE_PROTEIN, PROP_BIOCYC_ID),
                    # # 'FEATURE-OF': RelationshipType(),
                    'GENE': RelationshipType(REL_ENCODE, 'from', NODE_GENE, PROP_BIOCYC_ID),
                    # 'GO-TERMS': RelationshipType(REL_DBLINKS, 'to', DB_GO, PROP_GO_ID),
                    'IN-PATHWAY': RelationshipType(REL_CONTAINS, 'from', NODE_PATHWAY, PROP_BIOCYC_ID),
                    # 'INHIBITORS': RelationshipType(REL_INHIBITORS, 'to', None, PROP_BIOCYC_ID),
                    # # 'INVOLVED-IN-REGULATION': RelationshipType(),
                    # # 'KEY-REACTIONS': RelationshipType(),
                    'LEFT': RelationshipType(REL_CONSUMED_BY, 'to', None, PROP_BIOCYC_ID),
                    # # 'MODIFIED-FORM': RelationshipType(),
                    # # 'PRIMARIES': RelationshipType(),
                    # # 'PRODUCT': RelationshipType(),
                    # # 'REACTANTS': RelationshipType(),
                    # # this is for enzyme reaction
                    'REACTION': RelationshipType(REL_REACTION, 'to', NODE_REACTION, PROP_BIOCYC_ID),
                    # # 'REACTION-LIST': RelationshipType(REL_CONTAINS, 'to', NODE_REACTION, PROP_BIOCYC_ID),
                    # # 'REGULATED-BY': RelationshipType(REL_REGULATE, 'from', NODE_REGULATION, PROP_BIOCYC_ID),
                    'REGULATED-ENTITY': RelationshipType(REL_REGULATE, 'to', None, PROP_BIOCYC_ID),
                    # # 'REGULATES': RelationshipType(),
                    'REGULATOR': RelationshipType(REL_REGULATORS, 'from', None, PROP_BIOCYC_ID),
                    # # 'REQUIRED-PROTEIN-COMPLEX': RelationshipType(),
                    'RIGHT': RelationshipType(REL_PRODUCE, 'to', None, PROP_BIOCYC_ID),
                    # # 'SPECIES': RelationshipType(REL_SPECIES, 'to', NODE_SPECIES, PROP_BIOCYC_ID),
                    # # 'SPLICE-FORM-INTRONS': RelationshipType(),
                    # 'SUB-PATHWAYS': RelationshipType(),
                    'SUPER-PATHWAYS': RelationshipType(REL_CONTAINS, 'from', NODE_PATHWAY, PROP_BIOCYC_ID),
                    # 'TYPES': RelationshipType(REL_TYPE, 'to', NODE_CLASS, PROP_BIOCYC_ID),
                    'UNMODIFIED-FORM': RelationshipType(REL_MODIFIED_TO, 'from', None, PROP_BIOCYC_ID),
}


def get_attr_name_from_line(line: str)->str:
    if not line.startswith('/'):
        tokens = line.split(' - ')
        if len(tokens) > 1:
            return tokens[0]
    return None


def get_attr_val_from_line(line: str) ->():
    tokens = line.split(' - ')
    if len(tokens) > 1:
        attr = tokens[0]
        value = tokens[1].strip()
        return attr, value
    else:
        return None, None


def get_property_name_type(attr_name: str, attr_name_map=None):
    if not attr_name_map:
        attr_name_map = BIOCYC_ATTR_NAMES
    if attr_name in attr_name_map:
        name_type = attr_name_map[attr_name]
        if not name_type:
            return attr_name.lower().replace('-', '_'), None
        else:
            name = name_type[0]
            type = name_type[1]
            if not name:
                name = attr_name.lower().replace('-', '_')
            return name, type
    return None, None

def cleanhtml(raw_html):
    cleanr = re.compile('<.*?>')
    cleantext = re.sub(cleanr, '', raw_html)
    return cleantext



