import json
import logging
import os

from cloudstorage.cloud_mixin import CloudMixin
from common.constants import *
from typing import Type
from zipfile import ZipFile, ZIP_DEFLATED

from biocyc.base_data_file_parser import BaseDataFileParser
from biocyc import (
    class_parser,
    compound_parser,
    dnabindsite_parser,
    enzymereaction_parser,
    gene_parser,
    pathway_parser,
    promoter_parser,
    protein_parser,
    reaction_parser,
    regulation_parser,
    rna_parser,
    terminator_parser,
    transcriptionunit_parser,
)


# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))

ENTITIES = [
    NODE_CLASS,
    NODE_COMPOUND,
    NODE_DNA_BINDING_SITE,
    NODE_GENE,
    NODE_TERMINATOR,
    NODE_PROMOTER,
    NODE_TRANS_UNIT,
    NODE_RNA,
    NODE_PROTEIN,
    NODE_REACTION,
    NODE_PATHWAY,
    NODE_ENZ_REACTION,
    NODE_REGULATION,
]

PARSERS = {
    NODE_CLASS: class_parser.ClassParser,
    NODE_COMPOUND: compound_parser.CompoundParser,
    NODE_DNA_BINDING_SITE: dnabindsite_parser.DnaBindSiteParser,
    NODE_ENZ_REACTION: enzymereaction_parser.EnzymeReactionParser,
    NODE_GENE: gene_parser.GeneParser,
    NODE_PATHWAY: pathway_parser.PathwayParser,
    NODE_PROMOTER: promoter_parser.PromoterParser,
    NODE_PROTEIN: protein_parser.ProteinParser,
    NODE_REACTION: reaction_parser.ReactionParser,
    NODE_REGULATION: regulation_parser.RegulationParser,
    NODE_RNA: rna_parser.RnaParser,
    NODE_TERMINATOR: terminator_parser.TerminatorParser,
    NODE_TRANS_UNIT: transcriptionunit_parser.TranscriptionUnitParser,
}

ECOCYC_FILE = 'ecocyc.zip'


class BiocycParser(CloudMixin):
    def __init__(self, prefix: str, base_dir: str = None):
        self.base_dir = base_dir
        self.prefix = prefix

        # Read data source name and file from config
        with open(os.path.join(directory, 'data_sources.json')) as f:
            self.data_sources = {ds['name']: ds['file'] for ds in json.load(f)}

        # Default to loading all data source files
        self.data_sources_to_load = self.data_sources
        self.logger = logging.getLogger(__name__)

    def get_parser(
        self, entity_name: str, biocyc_dbname: str, filename: str
    ) -> Type[BaseDataFileParser]:
        return PARSERS[entity_name](self.prefix, biocyc_dbname, filename, self.base_dir)

    def link_genes(self, database):
        """
        Link biocyc genes to NCBI genes using accession number to match NCBI gene locustag.  Since human genes don't have
        accession, use gene name match.
        There is no Peusomonas (tax 160488) genes in NCBI.
        :param database:
        :return:
        """
        query_ecoli = """
        match (g:Gene:db_EcoCyc) 
        with g match (n:Gene)-[:HAS_TAXONOMY]-(:Taxonomy {id:'511145'}) where n.locus_tag = g.accession 
        merge (g)-[:IS]->(n)
        """
        self.logger.info("Link EcoCyc genes with NCBI genes")
        database.run_query(query_ecoli)

        query_yeast = """
        match (g:Gene:db_YeastCyc) 
        with g match (n:Gene)-[:HAS_TAXONOMY]-(:Taxonomy {id:'559292'}) where n.locus_tag = g.accession 
        merge (g)-[:IS]->(n)
        """
        self.logger.info("Link YeastCyc genes with NCBI genes")
        database.run_query(query_yeast)

        query_human = """
        match (n:Gene)-[:HAS_TAXONOMY]-(t:Taxonomy {id:'9606'}) with n match (g:Gene:db_HumanCyc) 
        where g.name = n.name merge (g)-[:IS]->(n)
        """
        self.logger.info("Link HumanCyc genes with NCBI genes")
        database.run_query(query_human)

    def set_gene_property_for_enrichment(self, database):
        """
        Add 'pathways' property to biocyc genes. Since the pathways and genes are organism specific, but not reactions,
        we need specify the db_name label for the genes and pathways.
        :param database:
        :return:
        """
        query = """
        match (n:$db_name:Gene) 
            with n match
            path=(n)-[:ENCODES]-()-[:COMPONENT_OF*0..]->()-[]-(:EnzReaction)--(:Reaction)--(p:Pathway:$db_name)
            with n, collect(p.name) as pathways set n.pathways = pathways 
        """
        for db in self.data_sources_to_load.keys():
            myquery = query.replace('$db_name', 'db_' + db)
            self.logger.info(f"Add pathways property to db_{db} genes")
            self.logger.debug(myquery)
            database.run_query(myquery)

    def add_protein_synonyms(self, database):
        """
        Add BioCyc protein abbrev_name as its synonym
        :param database: the database to run query
        """
        query = """
        match(n:db_BioCyc:Protein) where exists (n.abbrev_name) 
        merge(s:Synonym {name:n.abbrev_name})
        merge (n)-[:HAS_SYNONYM]->(s)
        """
        self.logger.info("Add protein synonyms")
        database.run_query(query)

    def load_data_into_neo4j(self, database=None):
        """
        Use the default ENTITIES and DB_FILE_DICT to load all 4 biocyc databases into KG database. After load data,
        need to run scripts to set displayname and description.  See docs/biocyc/set_displayname_description.md
        :param database: the neo4j database to load data
        """
        # loop data sources configured in data_sources.json
        for db, file in self.data_sources_to_load.items():
            version = ''
            for entity in ENTITIES:
                self.logger.info(f'Load {db}: {entity}')
                parser = self.get_parser(entity, db, file)
                parser.version = version
                if parser:
                    parser.parse_data_file()
                    parser.parse_and_write_data_files()
        self.zip_files(parser.output_dir)

    def zip_files(self, dir):
        with ZipFile(
            os.path.join(dir, f'jira-{self.prefix}.zip'), 'w', ZIP_DEFLATED
        ) as zipped:
            for parent, subfolders, filenames in os.walk(os.path.join(dir)):
                for fn in filenames:
                    [path, ext] = path.splitext(fn.lower())
                    if ext == '.tsv':
                        zipped.write(path.join(parent, fn), fn)


def main(args):
    logger = logging.getLogger(__name__)
    parser = BiocycParser(args.prefix)

    if args.data_sources:
        # load only the specified data sources
        parser.data_sources_to_load = {}
        for data_source_name in args.data_sources:
            if data_source_name in parser.data_sources:
                parser.data_sources_to_load[data_source_name] = parser.data_sources[
                    data_source_name
                ]
            else:
                raise ValueError(
                    f'The specified data source was not recognized: {data_source_name}'
                )
    else:
        logger.info('No data sources specified. Loading all data sources...')

    # After loading data, we (perhaps?) need to run scripts to set displayname and description. See docs/biocyc/set_displayname_description.md
    parser.load_data_into_neo4j()
    # TODO: Remove these later when done cleaning code
    # parser.link_genes(database)
    # parser.set_gene_property_for_enrichment(database)
    # parser.add_protein_synonyms(database)

    for filename in [
        'LL-3164-ecocyc.zip',
        'LL-3164-humancyc.zip',
        'LL-3164-metacyc.zip',
        'LL-3164-pseudomonascyc.zip',
        'LL-3164-yeastcyc.zip',
    ]:
        parser.upload_to_azure(
            f'jira-{filename}',
            os.path.join(directory, '../../data/processed/biocyc', f'jira-{filename}'),
            True,
        )


if __name__ == "__main__":
    main()
