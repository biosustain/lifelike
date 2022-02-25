import os
from datetime import datetime

from common.constants import *
from common.liquibase_utils import *
from common.query_builder import get_create_constraint_query, get_create_index_query

# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


class BiocycChangeLog(ChangeLog):
    def __init__(self, author: str, change_id_prefix: str):
        super().__init__(author, change_id_prefix)
        self.date_tag = datetime.today().strftime('%m%d%Y')
        self.change_sets = []

    def create_change_logs(self, initial_load=False):
        if initial_load:
            self.add_index_change_set()

    def create_indexes(self):
        queries = []
        queries.append(get_create_constraint_query(NODE_BIOCYC, PROP_BIOCYC_ID, 'constraint_biocyc_biocycid') + ';')
        queries.append(get_create_constraint_query(NODE_BIOCYC, PROP_ID, 'constraint_biocyc_id') + ';')
        queries.append(get_create_constraint_query(NODE_SYNONYM, PROP_NAME, 'constraint_synonym_name') + ';')
        queries.append(get_create_index_query(NODE_BIOCYC, PROP_NAME, 'index_biocyc_name') + ';')
        return queries

    def add_index_change_set(self):
        id = f'Biocyc data initial load {self.date_tag}'
        comment = 'Create constraints and indexes for Biocyc nodes'
        queries = self.create_indexes()
        query_str = '\n'.join(queries)
        changeset = ChangeSet(id, self.author, comment, query_str)
        self.change_sets.append(changeset)


if __name__ == '__main__':
    task = BiocycChangeLog('Binh Vu', 'LL-3164')
    task.create_change_logs(True)
    task.generate_liquibase_changelog_file('biocyc_changelog.xml', directory)
