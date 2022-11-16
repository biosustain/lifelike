import os
from datetime import datetime

from common.constants import *
from common.liquibase_utils import *
from common.query_builder import get_create_constraint_query
from literature.literature_data_parser import (
    LiteratureDataParser,
    ZENODO_CHEMICAL2DISEASE_FILE,
    ZENODO_CHEMICAL2GENE_FILE,
    ZENODO_GENE2DISEASE_FILE,
    ZENODO_GENE2GENE_FILE
)

# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


class LiteratureChangeLog(ChangeLog):
    def __init__(self, author: str, change_id_prefix: str):
        super().__init__(author, change_id_prefix)
        self.date_tag = datetime.today().strftime('%m%d%Y')
        self.change_sets = []

    def create_change_logs(self, initial_load=False):
        if initial_load:
            self.add_index_change_set()
        self.load_literature_model()
        self.load_literature_snippet_pub_rels()
        self.load_literature_chemical_mapped_rels()
        self.load_literature_disease_mapped_rels()
        self.load_literature_gene_mapped_rels()

    def load_literature_model(self):
        for filename, (entity1_type, entity2_type) in [
            (ZENODO_CHEMICAL2DISEASE_FILE, (NODE_CHEMICAL, NODE_DISEASE)),
            (ZENODO_CHEMICAL2GENE_FILE, (NODE_CHEMICAL, NODE_GENE)),
            (ZENODO_GENE2DISEASE_FILE, (NODE_GENE, NODE_DISEASE)),
            (ZENODO_GENE2GENE_FILE, (NODE_GENE, NODE_GENE))
        ]:
            id = f'Zenodo literature data {entity1_type}-{entity2_type} on date {self.date_tag}'
            if self.id_prefix:
                id = f'{self.id_prefix} {id}'
            comment = f'Split creation of {entity1_type}-{entity2_type} nodes and assocation from snippet creation; seem to be faster instead of one giant cypher' \
                '. Need to use foreach because if some entities can have two entity type so the on create will not set the second, and cannot use normal set cause it could add a duplicate.\n' \
                'The name property is a duplicate data property, and only used for the visualizer. Not sure why this decision was made, cause the information is' \
                ' available in the (n)-[MAPPED_TO]-(m) in m.name, the extra relationship does not seem to make any difference, in fact it is faster since the current visualizer query returns the entire node.\n' \
                'Need to also consider the fact the property could be at risk for being outdated.'
            query = LiteratureDataParser.get_create_literature_query(entity1_type, entity2_type)
            changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{filename}')
            self.change_sets.append(changeset)

    def load_literature_snippet_pub_rels(self):
        for filename, (entity1_type, entity2_type) in [
            (ZENODO_CHEMICAL2DISEASE_FILE, (NODE_CHEMICAL, NODE_DISEASE)),
            (ZENODO_CHEMICAL2GENE_FILE, (NODE_CHEMICAL, NODE_GENE)),
            (ZENODO_GENE2DISEASE_FILE, (NODE_GENE, NODE_DISEASE)),
            (ZENODO_GENE2GENE_FILE, (NODE_GENE, NODE_GENE))
        ]:
            id = f'Zenodo literature snippet data {entity1_type}-{entity2_type} on date {self.date_tag}'
            if self.id_prefix:
                id = f'{self.id_prefix} {id}'
            comment = f'Link snippets for {entity1_type}-{entity2_type} to publication. \nNeed to include properties in INDICATES relationship merge ' \
                'to be unique because there are multiple rows in data that can result in incorrectly merging the relationships.'
            query = LiteratureDataParser.get_create_literature_snippet_pub_query()
            changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{filename}')
            self.change_sets.append(changeset)

    def load_literature_chemical_mapped_rels(self):
        id = f'create MAPPED_TO for literature chemical on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'LiteratureChemical should be MAPPED_TO Chemical nodes (Chebi and Mesh); Need to use foreach because if label is included in the merge, it will create two different relationships if an entity has more than one entity label'
        query = """
        FOR n IN LiteratureChemical
            FILTER n.data_source == "db_Literature" && CONTAINS(n.eid, "MESH:")
            UPSERT { eid: SPLIT(n.eid, ":")[1] }
            INSERT { data_source: "db_MESH", eid: SPLIT(n.eid, ":")[1] }
            UPDATE { data_source: "db_MESH" }
            IN Chemical
            LET c = NEW
            UPSERT { _from: n._key, _to: c._key }
            INSERT { _from: n._key, _to: c._key }
            IN MAPPED_TO;
        FOR n IN LiteratureChemical
            FILTER n.data_source == "db_Literature" && CONTAINS(n.eid, "CHEBI:")
            UPSERT { eid: SPLIT(n.eid, ":")[1] }
            INSERT { data_source: "db_CHEBI", eid: SPLIT(n.eid, ":")[1] }
            UPDATE { data_source: "db_CHEBI" }
            IN Chemical
            LET c = NEW
            UPSERT { _from: n._key, _to: c._key }
            INSERT { _from: n._key, _to: c._key }
            IN MAPPED_TO;
        """
        changeset = ChangeSet(id, self.author, comment, query)
        self.change_sets.append(changeset)

    def load_literature_disease_mapped_rels(self):
        id = f'create MAPPED_TO for literature disease on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'LiteratureDisease should be MAPPED_TO Diseases nodes (db_MESH and Disease not in a domain, e.g OMIM:xxxxxx id); Need to use foreach because if label is included in the merge, it will create two different relationships if an entity has more than one entity label'
        query = """
        FOR n IN LiteratureDisease
            FILTER n.data_source == "db_Literature" && CONTAINS(n.eid, "MESH:")
            UPSERT { eid: SPLIT(n.eid, ":")[1] }
            INSERT { data_source: "db_MESH", eid: SPLIT(n.eid, ":")[1] }
            UPDATE { data_source: "db_MESH" }
            IN Disease
            LET c = NEW
            UPSERT { _from: n._key, _to: c._key }
            INSERT { _from: n._key, _to: c._key }
            IN MAPPED_TO;
        FOR n IN LiteratureDisease
            FILTER n.data_source == "db_Literature" && NOT CONTAINS(n.eid, "MESH:")
            UPSERT { eid: n.eid }
            INSERT { eid: n.eid }
            IN Disease
            LET c = NEW
            UPSERT { _from: n._key, _to: c._key }
            INSERT { _from: n._key, _to: c._key }
            IN MAPPED_TO;
        """
        changeset = ChangeSet(id, self.author, comment, query)
        self.change_sets.append(changeset)

    def load_literature_gene_mapped_rels(self):
        id = f'create MAPPED_TO for literature gene on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'LiteratureGene should be MAPPED_TO Gene nodes'
        query = """
        FOR n IN LiteratureGene
            FILTER n.data_source == "db_Literature"
            UPSERT { eid: eid:n.eid }
            INSERT { data_source: "db_NCBI", eid: eid:n.eid }
            UPDATE { data_source: "db_NCBI" }
            IN Gene
            LET g = NEW
            UPSERT { _from: n._key, _to: g._key }
            INSERT { _from: n._key, _to: g._key }
            IN MAPPED_TO;
        """
        changeset = ChangeSet(id, self.author, comment, query)
        self.change_sets.append(changeset)

    def create_indexes(self):
        queries = []
        queries.append(get_create_constraint_query(NODE_ASSOCIATION, PROP_ID, 'constraint_association_id') + ';')
        queries.append(get_create_constraint_query(NODE_SNIPPET, PROP_ID, 'constraint_snippet_id') + ';')
        queries.append(get_create_constraint_query(NODE_LITERATURE_ENTITY, PROP_ID, 'constraint_literatureentity_id') + ';')
        queries.append(get_create_constraint_query(NODE_LITERATURE_DISEASE, PROP_ID, 'constraint_literaturedisease_id') + ';')
        queries.append(get_create_constraint_query(NODE_LITERATURE_CHEMICAL, PROP_ID, 'constraint_literaturechemical_id') + ';')
        queries.append(get_create_constraint_query(NODE_LITERATURE_GENE, PROP_ID, 'constraint_literaturegene_id') + ';')
        queries.append(get_create_constraint_query(NODE_PUBLICATION, PROP_PUBLICATION_ID, 'constraint_publication_pmid') + ';')
        return queries

    def add_index_change_set(self):
        id = f'load Zenodo literature constraints on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'Create constraints and indexes for Zenodo literature'
        queries = self.create_indexes()
        query_str = '\n'.join(queries)
        changeset = ChangeSet(id, self.author, comment, query_str)
        self.change_sets.append(changeset)


if __name__ == '__main__':
    task = LiteratureChangeLog('Binh Vu', 'LL-3782')
    task.create_change_logs(True)
    task.generate_liquibase_changelog_file('literature_changelog.xml', directory)
