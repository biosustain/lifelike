from common.constants import *
from common.database import *
from biocyc import class_parser
from biocyc import compound_parser
from biocyc import dnabindsite_parser
from biocyc import enzymereaction_parser
from biocyc import gene_parser
from biocyc import pathway_parser
from biocyc import promoter_parser
from biocyc import protein_parser
from biocyc import reaction_parser
from biocyc import regulation_parser
from biocyc import rna_parser
from biocyc import terminator_parser
from biocyc import transcripitionunit_parser
import logging, os, csv, shutil

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

ENTITIES = [NODE_CLASS, NODE_COMPOUND, NODE_DNA_BINDING_SITE, NODE_GENE, NODE_TERMINATOR, NODE_PROMOTER,
            NODE_TRANS_UNIT, NODE_RNA, NODE_PROTEIN,
            NODE_REACTION, NODE_PATHWAY, NODE_ENZ_REACTION, NODE_REGULATION]

DB_FILE_DICT = {DB_ECOCYC: 'ecoli.tar.gz',
                DB_HUMANCYC: 'humancyc.tar.gz',
                DB_YEASTCYC: 'yeastcyc.tar.gz',
                DB_PPUT: 'pput160488cyc.tar.gz'}


class BiocycParser(object):
    def __init__(self, base_data_dir: str = None):
        self.base_data_dir = base_data_dir

    def get_parser(self, entity_name: str, biocyc_dbname, filename):
        if entity_name == NODE_CLASS:
            return class_parser.ClassParser(biocyc_dbname, filename, self.base_data_dir)
        if entity_name == NODE_COMPOUND:
            return compound_parser.CompoundParser(biocyc_dbname, filename, self.base_data_dir)
        if entity_name == NODE_DNA_BINDING_SITE:
            return dnabindsite_parser.DnaBindSiteParser(biocyc_dbname, filename, self.base_data_dir)
        if entity_name == NODE_ENZ_REACTION:
            return enzymereaction_parser.EnzymeReactionParser(biocyc_dbname, filename, self.base_data_dir)
        if entity_name == NODE_GENE:
            return gene_parser.GeneParser(biocyc_dbname, filename, self.base_data_dir)
        if entity_name == NODE_PATHWAY:
            return pathway_parser.PathwayParser(biocyc_dbname, filename, self.base_data_dir)
        if entity_name == NODE_PROMOTER:
            return promoter_parser.PromoterParser(biocyc_dbname, filename, self.base_data_dir)
        if entity_name == NODE_PROTEIN:
            return protein_parser.ProteinParser(biocyc_dbname, filename, self.base_data_dir)
        if entity_name == NODE_REACTION:
            return reaction_parser.ReactionParser(biocyc_dbname, filename, self.base_data_dir)
        if entity_name == NODE_REGULATION:
            return regulation_parser.RegulationParser(biocyc_dbname, filename, self.base_data_dir)
        if entity_name == NODE_RNA:
            return rna_parser.RnaParser(biocyc_dbname, filename, self.base_data_dir)
        if entity_name == NODE_TERMINATOR:
            return terminator_parser.TerminatorParser(biocyc_dbname, filename, self.base_data_dir)
        if entity_name == NODE_TRANS_UNIT:
            return transcripitionunit_parser.TranscriptionUnitParser(biocyc_dbname, filename, self.base_data_dir)

    def link_genes(self, database:Database):
        """
        Link biocyc genes to NCBI genes using accession number to match NCBI gene locustag.  Since human genes don't have
        accession, use gene name match.
        There is no Peusomonas (tax 160488) genes in NCBI.
        :param database:
        :return:
        """
        logging.info('link ecocyc genes with ncbi genes')
        query_ecoli = """
        match (g:Gene:db_EcoCyc) 
        with g match (n:Gene)-[:HAS_TAXONOMY]-(:Taxonomy {id:'511145'}) where n.locus_tag = g.accession 
        merge (g)-[:IS]->(n)
        """
        query_yeast = """
        match (g:Gene:db_YeastCyc) 
        with g match (n:Gene)-[:HAS_TAXONOMY]-(:Taxonomy {id:'559292'}) where n.locus_tag = g.accession 
        merge (g)-[:IS]->(n)
        """
        query_human = """
        match (n:Gene)-[:HAS_TAXONOMY]-(t:Taxonomy {id:'9606'}) with n match (g:Gene:db_HumanCyc) 
        where g.name = n.name merge (g)-[:IS]->(n)
        """
        database.run_query(query_ecoli)
        database.run_query(query_yeast)
        database.run_query(query_human)

    def set_display_names(self, database:Database):
        """
        Set node display name.  node 'id' property is already set to be same as biocyc_id when loading the nodes
        :param database: the database to run the queries
        """
        logging.info('set Regulation display name')
        query = """
        MATCH (n:Regulation)-[:TYPE_OF]->(t) 
        WHERE EXISTS (n.mode) 
        SET n.displayName = t.biocyc_id +' (' + n.mode + ')' 
        """
        database.run_query(query)

        query = """
        MATCH (n:Regulation)-[:TYPE_OF]->(t)  where NOT EXISTS(n.displayName) 
        SET n.displayName = t.biocyc_id
        """
        database.run_query(query)

        logging.info('set Reaction display name')
        query = """
        MATCH (n:Reaction) WITH n,
        CASE 
            WHEN NOT n.ec_number IS NULL THEN n.ec_number
            WHEN NOT n.name IS NULL THEN n.name
            ELSE n.biocyc_id 
        END as displayName
        set n.displayName = displayName
        """
        database.run_query(query)

        logging.info('set display name for TranscriptionUnit')
        query = "match (n:TranscriptionUnit) where exists(n.name) set n.displayName = n.name + ' TU'"
        database.run_query(query)
        query = """
        match (n:TranscriptionUnit) where not exists (n.displayName) 
        with n match (n)-[:ELEMENT_OF]-(g:Gene) with n, collect(g.name) as genes 
        set n.displayName = apoc.text.join(genes, '-') + ' TU'
        """
        database.run_query(query)

        logging.info('set display name for all')
        query = "match (n:db_BioCyc) where not exists (n.displayName) set n.displayName =n.name"
        database.run_query(query)
        query = "match (n:db_BioCyc) where not exists (n.displayName) set n.displayName =n.biocyc_id"
        database.run_query(query)

        logging.info('set display name for protein')
        query = "match (n:db_BioCyc:Protein) where not exists (n.displayName) set n.displayName =toLower(n.biocyc_id)"
        database.run_query(query)

        logging.info('set display name for binding site')
        query = "match (n:DNABindingSite)--(:Regulation)<-[]-(p:Protein) set n.displayName = p.displayName + ' BS'"
        database.run_query(query)

        logging.info('set display name for EnzReaction')
        query = """
        match (n:EnzReaction)-[]-(:Protein)<-[:COMPONENT_OF*0..]-(p)-[:ENCODES]-(g) 
            with n, collect(distinct g.name) as genes
            with n, case when size(genes)>0 then n.name + ' ('+ apoc.text.join(genes, ',') + ')'
            else n.name END as displayName 
        SET n.displayName = displayName
        """
        database.run_query(query)

    def set_descriptions(self, database:Database):
        """
        Set node discription, that is very useful for data analysis and annotation. We may need to add all those descriptions
        in file biocyc/create_ecocyc_mod_database_for_GDS.md to the lifelike database in the future.
        :param database: the database to run the query
        """
        logging.info('set description for genes')
        query = """
        match (n:Gene:db_EcoCyc)-[:IS]-(g:Gene:db_NCBI) set n.description = g.full_name;
        """
        database.run_query(query)
        query = """
        match (n:Gene:db_EcoCyc) where not exists(n.description) or n.description = '-' 
        with n match (n)-[:ENCODES]-(p) set n.description = p.name;
        """
        database.run_query(query)

    def set_gene_property_for_enrichment(self, database: Database):
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
        for db in DB_FILE_DICT.keys():
            myquery = query.replace('$db_name', 'db_' + db)
            print(myquery)
            database.run_query(myquery)

    def add_protein_synonyms(self, database: Database):
        """
        Add BioCyc protein abbrev_name as its synonym
        :param database: the database to run query
        """
        query = """
        match(n:db_BioCyc:Protein) where exists (n.abbrev_name) 
        merge(s:Synonym {name:n.abbrev_name})
        merge (n)-[:HAS_SYNONYM]->(s)
        """
        database.run_query(query)

    def load_data_into_neo4j(self, database: Database, entities=ENTITIES, db_files=DB_FILE_DICT, initial_load=False):
        """
        Use the default ENTITIES and DB_FILE_DICT to load all 4 biocyc databases into KG database
        :param database: the neo4j database to load data
        :param entities: List of entity node labels to load
        :param db_files: dict for biocyc database name  and data file name
        :param initial_load: if False, update the database (no need to create indexes).
        """
        if initial_load:
            database.create_constraint(NODE_BIOCYC, PROP_BIOCYC_ID, 'constraint_biocyc_biocycId')
            database.create_index(
                NODE_BIOCYC, PROP_NAME, 'index_biocyc_name')
            database.create_constraint(NODE_SYNONYM, PROP_NAME, 'constraint_synonym_name')
        for db, file in db_files.items():
            DB_NODE = 'db_' + db
            if initial_load:
                database.create_index(DB_NODE, PROP_BIOCYC_ID, f'index_{db}_{PROP_BIOCYC_ID}')
                database.create_index(DB_NODE, PROP_NAME, f'index_{db}_{PROP_NAME}')
            version = ''
            for entity in entities:
                logging.info(f'Load {db}: {entity}')
                parser = self.get_parser(entity, db, file)
                parser.version = version
                if parser:
                    nodes = parser.parse_data_file()
                    version = parser.version
                    if nodes:
                        parser.add_nodes_to_graphdb(nodes, database)
                        parser.add_edges_to_graphdb(nodes, database)
        self.link_genes(database)
        self.set_gene_property_for_enrichment(database)
        self.set_id_and_display_names(database)

    def update_nodes(self, db_name, data_file, entities: [], database: Database):
        for entity in entities:
            parser = self.get_parser(entity, db_name, data_file)
            if parser:
                parser.update_nodes_in_graphdb(parser.parse_data_file(), database)

    def update_edges(self, db_name, data_file, entities: [], database: Database):
        for entity in entities:
            parser = self.get_parser(entity, db_name, data_file)
            if parser:
                parser.add_edges_to_graphdb(parser.parse_data_file(), database)

    def write_entity_datafile(self, db_name, data_file, entities: []):
        for entity in entities:
            parser = self.get_parser(entity, db_name, data_file)
            if parser:
                parser.write_entity_data_files(parser.parse_data_file())


if __name__ == '__main__':
    datadir = '/Users/rcai/data'
    parser = BiocycParser(datadir)
    database = get_database(Neo4jInstance.LOCAL, 'ecocyc')
    parser.load_data_into_neo4j(database, ENTITIES, {DB_ECOCYC: 'ecoli.tar.gz'}, True)
    database.close()















