from liquibase_changelog_generator import *
from common.constants import NODE_SYNONYM, PROP_NAME, PROP_LOWERCASE_NAME
from common.query_builder import get_create_index_query, get_create_constraint_query
from config.config import Config


class SynonymIndexChangelogsGenerator(ChangeLogFileGenerator):
    def __init__(self, author):
        ChangeLogFileGenerator.__init__(self, author, None, None, NODE_SYNONYM)
        self.index_quieries = []

    def get_create_index_queries(self):
        self.index_quieries.append(get_create_constraint_query(NODE_SYNONYM, PROP_NAME))
        self.index_quieries.append(get_create_index_query(NODE_SYNONYM, PROP_LOWERCASE_NAME))
        return self.index_quieries

    def add_cypher_changesets(self):
        cyphers = Config().get_synonym_cyphers()
        for key, content in cyphers.items():
            id = f"{key}, data {self.date_tag}"
            desc = content['description']
            query = content['query']
            self.change_sets.append(ChangeSet(id, self.author, desc, query))

    def add_all_change_sets(self):
        self.add_index_changesets()
        self.add_cypher_changesets()


def main():
    task = SynonymIndexChangelogsGenerator('rcai')
    task.add_all_change_sets()
    task.generate_changelog_file(f"synonym_index_changelog_{task.date_tag.replace('/', '')}.xml")


if __name__ == '__main__':
   main()
