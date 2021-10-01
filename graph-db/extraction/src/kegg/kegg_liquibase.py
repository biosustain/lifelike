from common.constants import *
from kegg.kegg_parser import *
from kegg.kegg_data_loader import *
from common.query_builder import *
from common.liquibase_utils import *
from datetime import datetime


def update_outfiles_to_azure(basedir, fileprefix="jira-LL-3216-"):
    parser = KeggParser(basedir)
    parser.upload_azure_file(PATHWAY_FILE)
    parser.upload_azure_file(GENOME_FILE)
    parser.upload_azure_file(GENE_FILE)
    parser.upload_azure_file(KO_FILE)
    parser.upload_azure_file(GENE2KO_FILE)
    parser.upload_azure_file(GENOME2PATHWAY_FILE)
    parser.upload_azure_file(KO2PATHWAY_FILE)


class KeggChangeLog(object):
    def __init__(self, author, change_id_prefix):
        self.author = author
        self.id_prefix = change_id_prefix
        self.date_tag = datetime.today().strftime('%m%d%Y')
        self.change_sets = []

    def create_change_logs(self, initial_load=False):
        self.change_sets = []
        if initial_load:
            self.add_index_change_set()
        self.load_gene_nodes()
        self.load_ko_nodes()
        self.load_genome_nodes()
        self.load_pathway_nodes()
        self.load_gene2ko_rels()
        self.load_gene2ncbi_rels()
        self.load_ko2pathway_rels()
        self.load_genome2pathway_rels()

    def generate_liquibase_changelog_file(self, outfile):
        if not self.change_sets:
            print('need to call create_change_logs first')
            return
        template = get_changelog_template()
        changes = []
        for cs in self.change_sets:
            s = cs.create_changelog_str()
            print(s)
            changes.append(s)
        change_str = '\n\n'.join(changes)
        with open(outfile, 'w') as f:
            f.write(template.render(change_sets_str=change_str))


    def create_indexes(self):
        queries = []
        queries.append(get_create_constraint_query(NODE_KEGG, PROP_ID, "constraint_kegg_id") + ';')
        queries.append(get_create_constraint_query(NODE_KO, PROP_ID, 'constraint_ko_id') + ';')
        queries.append(get_create_constraint_query(NODE_PATHWAY, PROP_ID, 'constraint_pathway_id') + ';')
        queries.append(get_create_constraint_query(NODE_GENE, PROP_ID, 'constraint_gene_id') + ';')
        queries.append(get_create_constraint_query(NODE_GENOME, PROP_ID, 'constraint_genome_id') + ';')
        queries.append(get_create_constraint_query(NODE_SYNONYM, PROP_NAME, 'constraint_synonym_name') + ';')
        queries.append(get_create_constraint_query(NODE_PATHWAY, PROP_NAME, 'index_pathway_name') + ';')
        return queries

    def add_index_change_set(self):
        id = "KEGG data initial load " + datetime.today().strftime("%m%d%Y")
        comment = "Create constraints and indexes for kegg nodes"
        queries = self.create_indexes()
        query_str = '\n'.join(queries)
        changeset = ChangeSet(id, self.author, comment, query_str)
        self.change_sets.append(changeset)

    def load_gene_nodes(self):
        id = 'load kegg genes ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + id
        comment = 'Load KEGG gene nodes'
        query = KeggDataLoader.get_load_gene_query()
        changeset = CustomChangeSet(id, self.author, comment, query, GENE_FILE)
        self.change_sets.append(changeset)

    def load_genome_nodes(self):
        id = 'load kegg genomes ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + id
        comment = 'Load KEGG genome nodes'
        query = KeggDataLoader.get_load_geneome_query()
        changeset = CustomChangeSet(id, self.author, comment, query, GENOME_FILE)
        self.change_sets.append(changeset)

    def load_ko_nodes(self):
        id = 'load kegg ko ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + ' ' + id
        comment = 'Load KEGG KO nodes'
        query = KeggDataLoader.get_load_ko_query()
        changeset = CustomChangeSet(id, self.author, comment, query, KO_FILE)
        self.change_sets.append(changeset)

    def load_pathway_nodes(self):
        id = 'load kegg pathways ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + ' ' + id
        comment = 'Load KEGG pathway nodes'
        query = KeggDataLoader.get_load_pathway_query()
        changeset = CustomChangeSet(id, self.author, comment, query, PATHWAY_FILE)
        self.change_sets.append(changeset)

    def load_gene2ko_rels(self):
        id = 'load kegg gene2ko ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + ' ' + id
        comment = 'Load KEGG gene to ko relationships'
        query = KeggDataLoader.get_load_gene2ko_query()
        changeset = CustomChangeSet(id, self.author, comment, query, GENE2KO_FILE)
        self.change_sets.append(changeset)

    def load_ko2pathway_rels(self):
        id = 'load kegg ko2pathway ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + ' ' + id
        comment = 'Load KEGG KO to pathway relationships'
        query = KeggDataLoader.get_load_ko2pathway_query()
        changeset = CustomChangeSet(id, self.author, comment, query, KO2PATHWAY_FILE)
        self.change_sets.append(changeset)

    def load_genome2pathway_rels(self):
        id = 'load kegg genome2pathway ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + ' ' + id
        comment = 'Load KEGG genome to pathway relationships'
        query = KeggDataLoader.get_load_gene2ko_query()
        changeset = CustomChangeSet(id, self.author, comment, query, GENOME2PATHWAY_FILE)
        self.change_sets.append(changeset)

    def load_gene2ncbi_rels(self):
        id = 'load kegg gene2ncbigene ' + self.date_tag
        if self.id_prefix:
            id = self.id_prefix + ' ' + id
        comment = 'Load KEGG gene to NCBI gene relationships'
        query = KeggDataLoader.get_load_gene2ko_query()
        changeset = CustomChangeSet(id, self.author, comment, query, GENE_FILE)
        self.change_sets.append(changeset)


if __name__ == '__main__':
    task = KeggChangeLog('rcai', 'test ')
    task.create_change_logs(True)
    task.generate_liquibase_changelog_file('kegg_changelogs.xml')
