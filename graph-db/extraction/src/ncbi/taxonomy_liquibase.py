from common.liquibase_changelog_generator import *
from common.constants import *
from common.query_builder import *
from zipfile import ZipFile


class TaxonomyChangeLogsGenerator(ChangeLogFileGenerator):
    def __init__(self, author, zip_data_file: str, initial_load=True):
        ChangeLogFileGenerator.__init__(self, author, zip_data_file, DB_NCBI, NODE_TAXONOMY, initial_load)
        self.processed_data_dir = os.path.join(self.basedir, 'processed', NODE_TAXONOMY.lower())
        self.output_dir = os.path.join(self.basedir, 'changelogs', NODE_TAXONOMY.lower())
        os.makedirs(self.output_dir, 0o777, True)
        self.index_quieries = []
        self.logger = logging.getLogger(__name__)

    def get_create_index_queries(self):
        self.index_quieries.append(get_create_constraint_query(NODE_TAXONOMY, PROP_ID))
        self.index_quieries.append(get_create_constraint_query(NODE_SYNONYM, PROP_NAME))
        self.index_quieries.append(get_create_index_query(NODE_SYNONYM, PROP_LOWERCASE_NAME))
        self.index_quieries.append(get_create_index_query(NODE_TAXONOMY, PROP_NAME))
        self.index_quieries.append(get_create_index_query(NODE_TAXONOMY, 'species_id'))
        return self.index_quieries

    def add_node_changesets(self):
        with ZipFile(os.path.join(self.processed_data_dir, self.zipfile)) as zip:
            filename = "taxonomy.tsv"
            with zip.open(filename) as f:
                df = pd.read_csv(f, sep='\t')
                node_changeset = self.get_node_changeset(df, filename, NODE_NCBI, NODE_TAXONOMY,
                                                         index_db_label=False)
                self.change_sets.append(node_changeset)

    def add_synonym_changesets(self):
        with ZipFile(os.path.join(self.processed_data_dir, self.zipfile)) as zip:
            filenames = zip.namelist()
            file = "taxonomy-synonyms.tsv"
            if file in filenames:
                self.change_sets.append(self.get_synonym_changeset(file, NODE_TAXONOMY, [PROP_TYPE]))

    def add_relationship_changesets(self):
        file = 'taxononym-rels.tsv'
        changeset = self.get_simple_relationship_changeset(file, NODE_TAXONOMY, NODE_TAXONOMY, REL_PARENT)
        self.change_sets.append(changeset)


    def add_cypher_changesets(self):
        cyphers = Config().get_string_cyphers()
        for key, content in cyphers.items():
            id = f"{key}, data {self.date_tag}"
            desc = content['description']
            query = content['query']
            self.change_sets.append(ChangeSet(id, self.author, desc, query))

    def add_all_change_sets(self):
        self.add_index_changesets()
        self.add_node_changesets()
        self.add_relationship_changesets()
        self.add_synonym_changesets()
        self.add_cypher_changesets()


def main():
    task = TaxonomyChangeLogsGenerator('rcai', "taxonomy_data_220520.zip")
    task.add_all_change_sets()
    task.generate_changelog_file('taxonomy_changelog.xml')


if __name__ == '__main__':
    main()

