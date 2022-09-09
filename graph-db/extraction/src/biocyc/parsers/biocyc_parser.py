from biocyc.config import BiocycConfig
from common.base_parser import BaseParser
from common.constants import *
import os
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

from biocyc.parsers import enzymereaction_parser, class_parser, rna_parser, protein_parser, \
    reaction_parser, regulation_parser, terminator_parser, promoter_parser, \
    transcripitionunit_parser, dnabindsite_parser, compound_parser, pathway_parser, gene_parser, \
    species_parser, primary_parser


PARSERS = {
    NODE_CLASS: class_parser.ClassParser,
    NODE_COMPOUND: compound_parser.CompoundParser,
    NODE_DNA_BINDING_SITE: dnabindsite_parser.DnaBindSiteParser,
    NODE_ENZ_REACTION: enzymereaction_parser.EnzymeReactionParser,
    NODE_GENE: gene_parser.GeneParser,
    NODE_PATHWAY: pathway_parser.PathwayParser,
    NODE_PRIMARY: primary_parser.PrimaryParser,
    NODE_PROMOTER: promoter_parser.PromoterParser,
    NODE_PROTEIN: protein_parser.ProteinParser,
    NODE_REACTION: reaction_parser.ReactionParser,
    NODE_REGULATION: regulation_parser.RegulationParser,
    NODE_RNA: rna_parser.RnaParser,
    NODE_SPECIES: species_parser.SpeciesParser,
    NODE_TERMINATOR: terminator_parser.TerminatorParser,
    NODE_TRANS_UNIT: transcripitionunit_parser.TranscriptionUnitParser,
}


class BiocycParser(BaseParser):
    def __init__(self, biocyc_dbname: str):
        """
        @param biocyc_dbname: biocyc database name, e.g. EcoCyc, HumanCyc, YeastCyc ...
        @param is_independent_db: if True, the database is not independent, not part of bigger database,
        then we don't need the db_BioCyc labels for all nodes
        """
        BaseParser.__init__(self, DB_BIOCYC.lower())
        self.config = BiocycConfig(biocyc_dbname)
        self.output_dir = os.path.join(self.output_dir, biocyc_dbname.lower())
        self.biocyc_dbname = biocyc_dbname
        self.org_id = ''
        self.version = ''
        self.logger = logging.getLogger(__name__)

    def get_parser(self, entity_name):
        return PARSERS[entity_name](self.biocyc_dbname, self.config['data'])

    def parse_and_write_data_files(self):
        """
        Use the default ENTITIES and DB_FILE_DICT to load all 4 biocyc databases into KG database. After load data,
        need to run scripts to set displayname and description.  See docs/biocyc/set_displayname_description.md
        :param database: the neo4j database to load data
        """
        all_files = []
        for entity in self.config.entities:
            self.logger.info(f"Load {self.biocyc_dbname}: {entity}")
            parser = self.get_parser(entity)
            parser.version = self.config.version
            if parser:
                # set parser org_id so that the node can link to the biocyc URL
                parser.org_id = self.org_id
                nodes = parser.parse_data_file()
                if entity == NODE_SPECIES:
                    self.org_id = nodes[0].get_attribute(PROP_ID)
                if nodes:
                    all_files += parser.parse_and_write_data_files(nodes)
        zip_file = self.config.data_output_zip
        logging.info(f'create zip file: {zip_file}')
        self.zip_output_files(all_files, zip_file)


def parse(biocyc_dbname):
    parser = BiocycParser(biocyc_dbname)
    parser.parse_and_write_data_files()


def main(args):
    for biocyc_dbname in args.data_sources:
        parse(biocyc_dbname)

# if __name__ == "__main__":
#     # parse(DB_ECOCYC)
#     parse(DB_PSYRCYC)
