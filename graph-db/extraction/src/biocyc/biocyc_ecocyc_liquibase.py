import os
from datetime import datetime

from common.constants import *
from common.liquibase_utils import *
from common.query_builder import (
    get_create_constraint_query,
    get_create_index_query,
    get_create_relationships_query,
    get_create_update_nodes_query
)
from biocyc.biocyc_parser import ECOCYC_FILE

# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


class BiocycEcocycChangeLog(ChangeLog):
    def __init__(self, author: str, change_id_prefix: str):
        super().__init__(author, change_id_prefix)
        self.date_tag = datetime.today().strftime('%m%d%Y')
        self.change_sets = []

    def create_change_logs(self, initial_load=False):
        if initial_load:
            self.add_index_change_set()
        self.load_biocyc_ecocyc_class_nodes()
        self.load_biocyc_ecocyc_class_rels()

    def create_indexes(self):
        queries = []
        queries.append(get_create_constraint_query(NODE_ECOCYC, PROP_ID, 'constraint_ecocyc_id') + ';')
        queries.append(get_create_constraint_query(NODE_ECOCYC, PROP_BIOCYC_ID, 'constraint_ecocyc_biocycid') + ';')
        queries.append(get_create_index_query(NODE_ECOCYC, PROP_NAME, 'index_ecocyc_name') + ';')
        return queries

    def add_index_change_set(self):
        id = f'Biocyc Ecocyc data initial load {self.date_tag}'
        comment = 'Create constraints and indexes for Biocyc Ecocyc nodes'
        queries = self.create_indexes()
        query_str = '\n'.join(queries)
        changeset = ChangeSet(id, self.author, comment, query_str)
        self.change_sets.append(changeset)

    def load_biocyc_ecocyc_class_nodes(self):
        id = f'Create Biocyc Ecocyc nodes on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f''
        query = get_create_update_nodes_query(NODE_BIOCYC, PROP_BIOCYC_ID, [PROP_BIOCYC_ID, PROP_NAME, PROP_ID, PROP_SYNONYMS], [NODE_BIOCYC, NODE_ECOCYC, NODE_CLASS], datasource='BioCyc')
        changeset = ZipCustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}biocyc-class-nodes.tsv', f'{self.file_prefix}{ECOCYC_FILE}')
        self.change_sets.append(changeset)

    def load_biocyc_ecocyc_class_rels(self):
        id = f'Create Biocyc Ecocyc relationship on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = f''
        query = get_create_relationships_query(NODE_BIOCYC, PROP_BIOCYC_ID, 'from_id', NODE_BIOCYC, PROP_BIOCYC_ID, 'to_id', REL_TYPE)
        changeset = ZipCustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}biocyc-class-node-rels.tsv', f'{self.file_prefix}{ECOCYC_FILE}')
        self.change_sets.append(changeset)


if __name__ == '__main__':
    task = BiocycEcocycChangeLog('Binh Vu', 'LL-3164')
    task.create_change_logs(True)
    task.generate_liquibase_changelog_file('biocyc_ecocyc_changelog.xml', directory)
