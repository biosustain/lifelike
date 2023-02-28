import os.path
from pathlib import Path

from common.liquibase_changelog_generator import *
from common.constants import *
from common.query_builder import *
from biocyc.parsers.biocyc_parser import ENTITIES
from config.config import Config
import pandas as pd
from zipfile import ZipFile

from src.common.constants import DB_MCAP243233CYC


class BioCycChangeLogsGenerator(ChangeLogFileGenerator):
    def __init__(self, author:str, biocyc_dbname:str, zip_data_file:str,
                 initial_load=True):
        ChangeLogFileGenerator.__init__(self, author, zip_data_file, DB_BIOCYC, None, initial_load, subpath=(biocyc_dbname,))
        self.processed_data_dir = os.path.join(self.processed_data_dir, biocyc_dbname.lower())
        self.biocyc_dbname = biocyc_dbname
        self.biocycdb_label = 'db_' + self.biocyc_dbname
        self.index_quieries = []
        self.logger = logging.getLogger(__name__)

    def get_create_index_queries(self):
        self.add_common_index_queries()
        self.add_entity_index_queries()
        return self.index_quieries

    def add_common_index_queries(self):
        self.index_quieries.append(get_create_constraint_query(NODE_BIOCYC, PROP_ID))
        self.index_quieries.append(get_create_index_query(NODE_BIOCYC, PROP_BIOCYC_ID))
        self.index_quieries.append(get_create_index_query(NODE_BIOCYC, PROP_NAME))
        self.index_quieries.append(get_create_index_query(self.biocycdb_label, PROP_ID))
        self.index_quieries.append(get_create_index_query(self.biocycdb_label, PROP_BIOCYC_ID))
        self.index_quieries.append(get_create_index_query(self.biocycdb_label, PROP_NAME))
        self.index_quieries.append(get_create_constraint_query(NODE_SYNONYM, PROP_NAME))
        self.index_quieries.append(get_create_index_query(NODE_SYNONYM, PROP_LOWERCASE_NAME))

    def add_entity_index_queries(self):
        with ZipFile(os.path.join(self.processed_data_dir, self.zipfile)) as zip:
            filenames = zip.namelist()
        for entity in ENTITIES:
            entity_data_file = f"{entity}.tsv"
            if entity_data_file in filenames:
                self.index_quieries.append(get_create_index_query(entity, PROP_ID))
                self.index_quieries.append(get_create_index_query(entity, PROP_BIOCYC_ID))
                self.index_quieries.append(get_create_index_query(entity, PROP_NAME))

    def add_node_changesets(self):
        with ZipFile(os.path.join(self.processed_data_dir, self.zipfile)) as zip:
            filenames = zip.namelist()
            for entity in ENTITIES:
                file = f"{entity}.tsv"
                if file in filenames:
                    self.logger.info(f"read {file}")
                    with zip.open(file) as f:
                        df = pd.read_csv(f, sep='\t')
                        self.change_sets.append(self.get_node_changeset(df, file, entity, NODE_BIOCYC,
                                                                        ['db_'+self.biocyc_dbname]))

    def add_synonym_changesets(self):
        with ZipFile(os.path.join(self.processed_data_dir, self.zipfile)) as zip:
            filenames = zip.namelist()
            for entity in ENTITIES:
                file = f"{entity}-synonyms.tsv"
                if file in filenames:
                    self.logger.info(f"read {file}")
                    with zip.open(file) as f:
                        df = pd.read_csv(f, sep='\t')
                        self.change_sets.append(self.get_synonym_changeset(file, entity))

    def add_relationship_changesets(self):
        with ZipFile(os.path.join(self.processed_data_dir, self.zipfile)) as zip:
            filenames = zip.namelist()
            for entity in ENTITIES:
                file = f"{entity}-rels.tsv"
                if file in filenames:
                    self.logger.info(f"read {file}")
                    with zip.open(file) as f:
                        df = pd.read_csv(f, sep='\t')
                        rel_props = df\
                            .drop(columns=[REL_RELATIONSHIP, PROP_FROM_ID, PROP_TO_ID])\
                            .dropna(axis=1, how='all')\
                            .columns.tolist()
                        self.change_sets += self.get_relationships_changesets(
                            df, file, NODE_BIOCYC, NODE_BIOCYC, rel_props
                        )
                file = f"{entity}-dblinks.tsv"
                if file in filenames:
                    self.logger.info(f"read {file}")
                    with zip.open(file) as f:
                        df = pd.read_csv(f, sep='\t')
                        self.change_sets += self._get_dblink_changeset(df, file, entity)

    def _get_dblink_changeset(self, df, file, entity):
        dbnames = df[PROP_DB_NAME].drop_duplicates()
        changesets = []
        for dbname in dbnames:
            rel = f"{dbname.upper()}_LINK"
            dbnode = 'db_' + dbname
            id = f'load {entity} {rel} from {self.zipfile}, date {self.date_tag}'
            comment = f'Load {entity} {rel}: {file} from {self.zipfile}'
            query = get_create_relationships_query(NODE_BIOCYC, PROP_ID, PROP_FROM_ID,
                                                   dbnode, PROP_ID, PROP_TO_ID, rel,
                                                   row_filter_property=PROP_DB_NAME, row_filter_value=dbname)
            changeset = CustomChangeSet(id, self.author, comment, query,
                                        handler=QUERY_HANDLER,
                                        filename=file,
                                        zipfile=self.zipfile)
            changesets.append(changeset)
        return changesets

    def generate_init_changelog_file(self):
        self.add_all_change_sets()
        filename = Path(
            f"changelog-0010-{self.biocyc_dbname}-init-{self.date_tag}.xml"
        )
        self.generate_changelog_file(filename)


class BioCycCypherChangeLogsGenerator(ChangeLogFileGenerator):
    """
    Create cypher query change logs
    """
    def __init__(self, author, biocyc_dbname, genelink_cypher=""):
        """
        if genelink_cypher is not empty, use it to create gene-ndbi_gene links. Otherwise, use the cypher query in biocyc_cypher.yml file
        """
        ChangeLogFileGenerator.__init__(self, author, None, DB_BIOCYC, '', subpath=(biocyc_dbname,))
        self.biocyc_dbname = biocyc_dbname
        self.genelink_cypher = genelink_cypher
        config = Config()
        self.cyphers = config.get_biocyc_cyphers()

    def generate_post_load_changlog_file(self, filename=None):
        self.change_sets = []
        for key, content in self.cyphers.items():
            if key == 'set_gene_link' and self.genelink_cypher:
                # replace the query in yaml file
                content['query'] = self.genelink_cypher
            if content['type'] in ['post-modification', 'enrichment', 'db-link']:
                self.change_sets.append(self.create_changeset(key, content))
        if not filename:
            filename = f"changelog-0050-{self.biocyc_dbname}-post-load-{self.date_tag}.xml"
        self.logger.info("write " + filename)
        self.generate_changelog_file(filename)

    def generate_gds_non_collapse_changelog_file(self, filename=None):
        self.change_sets = []
        for key, content in self.cyphers.items():
            if 'collapse' not in key:
                self.change_sets.append(self.create_changeset(key, content))
        if not filename:
            filename = f"changelog-0020-{self.biocyc_dbname}-gds-no-collapse-{self.date_tag}.xml"
        self.logger.info("write " + filename)
        self.generate_changelog_file(filename)

    def generate_gds_reg_collapse_changelog_file(self, filename=None):
        self.change_sets = []
        for key, content in self.cyphers.items():
            if 'collapse' not in key  or key=='collapse_Regulation_nodes':
                self.change_sets.append(self.create_changeset(key, content))
        if not filename:
            filename = f"changelog-0020-{self.biocyc_dbname}-gds-reg-collapse-{self.date_tag}.xml"
        self.logger.info("write " + filename)
        self.generate_changelog_file(filename)

    def generate_gds_changelog_file(self, filename=None):
        self.change_sets = []
        for key, content in self.cyphers.items():
            self.change_sets.append(self.create_changeset(key, content))
        if not filename:
            filename = f"changelog-0020-{self.biocyc_dbname}-gds-{self.date_tag}.xml"
        self.logger.info("write " + filename)
        self.generate_changelog_file(filename)

    def create_changeset(self, query_id, content:{}):
        id = f"{query_id}, date {self.date_tag}"
        desc = content['description']
        isTemplate = content.get('template', False)
        query = content['query']
        if isTemplate:
            query = Template(query).render(db_name='db_' + self.biocyc_dbname)
        # query = query.replace(';', ';\n')
        return ChangeSet(id, self.author, desc, query)


def generate_changelog_files(zip_datafile, biocyc_dbname, author):
    """
    The code will generate three changelog files: init_changelog, post_load_changelog and gds_changelog.
    init_changelog loads all the parser output data into neo4j;
    post_load_changelog sets additional properties such as displayName, enrichment properties, enzyme_names;
    gds_changelog does all post_load_changelog does, with additional modification specific for gds analysis;

    For ***ARANGO_DB_NAME***, we will need init_changelog and post_load_changelog.
    For individual gds database, we will need init_changelog and gds_changelog.

    """
    proc = BioCycChangeLogsGenerator(author, biocyc_dbname, zip_datafile, True)
    proc.generate_init_changelog_file()

    proc = BioCycCypherChangeLogsGenerator(author, biocyc_dbname)
    proc.generate_post_load_changlog_file()
    proc.generate_gds_non_collapse_changelog_file()
    proc.generate_gds_reg_collapse_changelog_file()
    proc.generate_gds_changelog_file()


if __name__ == "__main__":
    # generate_changelog_files('PseudomonasAeruginosaPAO1-data-24.0.zip', DB_PSEUDOMONAS_AERUGINOSA_PAO_1, 'dommas')
    # generate_changelog_files('BsubCyc-data-47.zip', DB_BSUBCYC, 'rcai')
    generate_changelog_files('StreptomycesCoelicolorA3_2-data-24.0.zip', DB_STREPTOMYCES_COELICOLOR_A3_2, '---')
    # generate_changelog_files('PseudomonasPutidaKT2440-data-24.0.zip', DB_PSEUDOMONAS_PUTIDA_KT_2440, 'dommas')
    # generate_changelog_files('EcoCyc-data-25.5.zip', DB_ECOCYC, 'dommas')
    # generate_changelog_files('HumanCyc-data-24.0.zip', DB_HUMANCYC, 'dommas')
    # generate_changelog_files('mcap243233cyc-data-24.0.zip', DB_MCAP243233CYC, '---')




