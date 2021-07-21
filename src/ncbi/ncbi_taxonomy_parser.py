from common.database import *
from common.base_parser import BaseParser
from common.constants import *
import pandas as pd
import logging


"""
URL = 'https://ftp.ncbi.nlm.nih.gov/pub/taxonomy/new_taxdump/'
    nodes.dmp file consists of taxonomy nodes. The description for each node includes the following
    fields:
            tax_id					-- node id in GenBank taxonomy database
            parent tax_id				-- parent node id in GenBank taxonomy database
            rank					-- rank of this node (superkingdom, kingdom, ...) 
            embl code				-- locus-name prefix; not unique
            division id				-- see division.dmp file
            inherited div flag  (1 or 0)		-- 1 if node inherits division from parent
            genetic code id				-- see gencode.dmp file
            inherited GC  flag  (1 or 0)		-- 1 if node inherits genetic code from parent
            mitochondrial genetic code id		-- see gencode.dmp file
            inherited MGC flag  (1 or 0)		-- 1 if node inherits mitochondrial gencode from parent
            GenBank hidden flag (1 or 0)            -- 1 if name is suppressed in GenBank entry lineage
            hidden subtree ***ARANGO_USERNAME*** flag (1 or 0)       -- 1 if this subtree has no sequence data yet
            comments				-- free-text comments and citations

        Taxonomy names file (names.dmp): not all tax_id in the file
            tax_id					-- the id of node associated with this name
            name_txt				-- name itself
            unique name				-- the unique variant of this name if name not unique
            name class				-- (synonym, common name, ...)

        Full name lineage file fields:
            tax_id                  -- node id
            tax_name                -- scientific name of the organism
            lineage                 -- sequence of sncestor names separated by semicolon ';' denoting nodes' ancestors starting from the most distant one and ending with the immediate one


    For nodes.dmp, use only tax_id, parent_tax_id and rank fields
    For names.dmp, keep only names if name_class = synonym or 'scientific name'
"""

PROP_MAP = {
    'synonym': PROP_SYNONYMS,
    'scientific name': PROP_SCIENTIFIC_NAME
}
TOP_CLASS_TAXONOMY = ['Archaea', 'Bacteria', 'Eukaryota', 'Viruses']
EXCLUDED_NAMES = ['environmental sample']

NODES_FILE = 'nodes.dmp'
NAMES_FILE = 'names.dmp'
LINEAGE_FILE = 'fullnamelineage.dmp'


class TaxonomyParser(BaseParser):
    def __init__(self, base_dir:str=None):
        BaseParser.__init__(self, 'taxonomy', base_dir)
        self.nodes_file = os.path.join(self.download_dir, 'new_taxdump', 'nodes.dmp')
        self.names_file = os.path.join(self.download_dir, 'new_taxdump', 'names.dmp')
        self.lineage_file = os.path.join(self.download_dir, 'new_taxdump', 'fullnamelineage.dmp')
        self.top_class_nodes = []
        self.logger = logging.getLogger(__name__)

    def parse_node_file(self):
        df = pd.read_csv(self.nodes_file, sep='|', names=['tax_id', 'parent_id', 'rank'], usecols=[0, 1, 2])
        self.logger.debug(f"Length df: {len(df)}")
        df_pc = df[['tax_id', 'parent_id']].groupby('parent_id', as_index=False).agg(list)
        self.logger.debug(f"Length df_pc: {len(df_pc)}")