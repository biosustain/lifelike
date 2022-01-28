import os
from datetime import datetime

from common.constants import *
from common.liquibase_utils import *
from common.query_builder import (
    get_create_constraint_query,
    get_create_index_query,
    get_create_relationships_query,
    get_create_synonym_relationships_query,
    get_create_update_nodes_query
)

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


if __name__ == '__main__':
    task = BiocycEcocycChangeLog('Binh Vu', 'LL-3164')
    task.create_change_logs(True)
    task.generate_liquibase_changelog_file('biocyc_ecocyc_changelog.xml', directory)
