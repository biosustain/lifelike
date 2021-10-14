import os
from datetime import datetime

from common.constants import *
from common.liquibase_utils import *
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

    def create_change_logs(self):
        self.load_literature_model()
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
            comment = ''
            query = LiteratureDataParser.get_create_literature_query(entity1_type, entity2_type)
            changeset = CustomChangeSet(id, self.author, comment, query, f'{self.file_prefix}{filename}')
            self.change_sets.append(changeset)

    def load_literature_chemical_mapped_rels(self):
        id = f'create MAPPED_TO for literature chemical on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'LiteratureChemical should be MAPPED_TO Chemical nodes (Chebi and Mesh)'
        query = """
        CALL apoc.periodic.iterate(
        'MATCH (n:db_Literature:LiteratureChemical) WHERE n.eid CONTAINS 'MESH:' RETURN n',
        'MERGE (n)-[:MAPPED_TO]->(c:db_MESH:Chemical {eid:split(n.eid, ':')[1]})',
        {batchSize:10000});
        CALL apoc.periodic.iterate(
        'MATCH (n:db_Literature:LiteratureChemical) WHERE n.eid CONTAINS 'CHEBI:' RETURN n',
        'MERGE (n)-[:MAPPED_TO]->(c:db_CHEBI:Chemical {eid:split(n.eid, ':')[1]})',
        {batchSize:10000});
        """
        changeset = ChangeSet(id, self.author, comment, query)
        self.change_sets.append(changeset)

    def load_literature_disease_mapped_rels(self):
        id = f'create MAPPED_TO for literature disease on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'LiteratureDisease should be MAPPED_TO Diseases nodes (db_MESH and Disease not in a domain, e.g OMIM:xxxxxx id)'
        query = """
        CALL apoc.periodic.iterate(
        'MATCH (n:db_Literature:LiteratureDisease) WHERE n.eid CONTAINS 'MESH:' RETURN n',
        'MERGE (n)-[:MAPPED_TO]->(d:db_MESH:Disease {eid:split(n.eid, ':')[1]})',
        {batchSize:10000});
        CALL apoc.periodic.iterate(
        'MATCH (n:db_Literature:LiteratureDisease) WHERE NOT n.eid CONTAINS 'MESH:' RETURN n',
        'MERGE (n)-[:MAPPED_TO]->(d:Disease {eid:n.eid})',
        {batchSize:10000});
        """
        changeset = ChangeSet(id, self.author, comment, query)
        self.change_sets.append(changeset)

    def load_literature_gene_mapped_rels(self):
        id = f'create MAPPED_TO for literature gene on date {self.date_tag}'
        if self.id_prefix:
            id = f'{self.id_prefix} {id}'
        comment = 'LiteratureGene should be MAPPED_TO Gene nodes'
        query = """
        CALL apoc.periodic.iterate(
        'MATCH (n:db_Literature:LiteratureGene) RETURN n',
        'MERGE (n)-[:MAPPED_TO]->(g:db_NCBI:Gene {eid:n.eid})',
        {batchSize:10000});
        """
        changeset = ChangeSet(id, self.author, comment, query)
        self.change_sets.append(changeset)


if __name__ == '__main__':
    task = LiteratureChangeLog('Binh Vu', 'LL-3782')
    task.create_change_logs()
    task.generate_liquibase_changelog_file('literature_changelog.xml', directory)
