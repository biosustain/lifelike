import csv, logging, gzip, sys
from common.constants import *
from common.base_parser import BaseParser
from common.database import *

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])

STRING_TAX_IDS = ['9606', '511145', '160488', '559292', '4932']

class StringProtein:
    def __init__(self):
        self.id = ''
        self.name = ''
        self.protein_size = ''
        self.annotation = ''
        self.refseq = ''
        self.tax_id = ''

class StringParser(BaseParser):
    """
    The parser was from old code, and was not tested recently.  Also the data loading code should be separated into separate file.
    """
    def __init__(self, base_dir=None):
        BaseParser.__init__(self, DB_STRING.lower())

    def parse_protein_info(self):
        '''
        Parse protein info files, and get a map for string_id->StringProtein
        :return: dict with key = string_id, value = StringProtein
        '''
        files = os.listdir(self.download_dir)
        protein_map = dict()
        for file in files:
            if file.endswith('.gz') and 'protein.info' in file:
                with gzip.open(os.path.join(self.download_dir, file), 'rt') as f:
                    logging.info("parse file: " + file)
                    f.readline()
                    reader = csv.reader(f, delimiter='\t')
                    for row in reader:
                        protein = StringProtein()
                        protein.id = row[0]
                        protein.name = row[1]
                        protein.protein_size = row[2]
                        protein.annotation = '"' + row[3].replace('"', '') + '"'
                        protein.tax_id = protein.id[:protein.id.find('.')]
                        protein_map[protein.id] = protein

        for file in files:
            if file.endswith('.gz') and 'refseq_2_string' in file:
                logging.info('parse data from ' + file)
                with gzip.open(os.path.join(self.download_dir, file), 'rt') as f:
                    f.readline()
                    reader = csv.reader(f, delimiter='\t')
                    for row in reader:
                        id = row[2]
                        if id in protein_map:
                            protein = protein_map[id]
                            # protein.tax_id = row[0]
                            protein.refseq = row[1]
        return protein_map.values()

    def write_protein_info_file(self):
        """
        write string protein info to tsv file for given organisms (in download folder).
        protein fields: id, name, tax_id, refseq, annotation
        :return: None
        """
        outfile = os.path.join(self.output_dir, 'string.tsv')
        proteins = self.parse_protein_info()
        with open(outfile, 'w') as f:
            # cols: id, name, protein_size, annotation
            logging.info('write file ' + outfile)
            for protein in proteins:
                f.write('\t'.join([protein.id, protein.name, protein.protein_size, protein.annotation, protein.tax_id, protein.refseq]) + '\n')
        logging.info('total strings: ' + str(len(proteins)))

    def write_header_files_for_import(self):
        with open(os.path.join(self.output_dir, 'string_header.tsv'), 'w') as f:
            f.write('id:ID(STRING-ID)\tname\tprotein_size\tannotation\ttax_id\trefseq\n')

    def write_data_files_for_import(self):
        self.write_protein_info_file()
        self.write_gene2accession_file()
        self.write_string2gene()


    def write_gene2accession_file(self, tax_ids: [], outfile_name):
        logging.info("writing " + outfile_name)
        with gzip.open(os.path.join(self.download_dir, 'gene2accession.gz'), 'rt') as f, open(outfile_name, 'w') as outfile:
            f.readline()
            for line in f:
                row = line.split('\t')
                if row[5].strip() == '-':
                    continue
                if not tax_ids or (tax_ids and row[0].strip() in tax_ids):
                    outfile.write('\t'.join([row[0], row[1], row[5].split('.')[0]]) + '\n')

    def write_gene2refseq_file(self, tax_ids: [], outfile_name):
        logging.info("writing " + outfile_name)
        with gzip.open(os.path.join(self.download_dir, 'gene2refseq.gz'), 'rt') as f, \
                open(outfile_name, 'w') as outfile:
            f.readline()
            for line in f:
                row = line.split('\t')
                if row[5].strip() == '-':
                    continue
                if not tax_ids or (tax_ids and row[0].strip() in tax_ids):
                    outfile.write('\t'.join([row[0], row[1], row[5].split('.')[0]]) + '\n')


    def write_string2gene(self):
        # match string protein with NCBI genes through gene2accession.  The refseq in STRING DB are actually accession for NCBI genes
        # create lookup dict for accession-to-geneId
        gene2access_file = os.path.join(self.output_dir, 'string_gene2accession.tsv')
        # get accession-gene dict
        with open(gene2access_file, 'r') as f:
            reader = csv.reader(f,  delimiter='\t')
            accession2gene_map = {row[2]:row[1] for row in reader}
        outfile = os.path.join(self.output_dir, 'string2gene.tsv')
        matchcnt_file = os.path.join(self.output_dir, 'string2gene_count.tsv')
        with open(os.path.join(self.output_dir, 'string.tsv'), 'r') as f, open(outfile, 'w') as out, open(matchcnt_file, 'w') as cnt:
            reader = csv.reader(f, delimiter='\t')
            for row in reader:
                if row[5]:
                    refseqs = row[5].split('|')
                    genes = set()
                    for reqseq in refseqs:
                        if reqseq in accession2gene_map:
                            gene = accession2gene_map[reqseq]
                            genes.add(gene)
                    out.writelines([f'{row[0]}\t{g}\n' for g in genes])
                    cnt.write(f'{row[0]}\t{len(genes)}\n')

    def load_data_to_neo4j(self, database: Database):
        logging.info("load STRING protein info")
        file = os.path.join(self.output_dir, 'string.tsv')
        headers = [PROP_ID, PROP_NAME, 'protein_size', 'annotation', 'tax_id', 'refseq']
        query = get_create_update_nodes_query(NODE_STRING, PROP_ID, headers, [NODE_PROTEIN])
        database.load_csv_file(file, headers, query,  0, '\t', 2000,  [PROP_ID, 'tax_id'])

        # add name as synonym
        logging.info('Add STRING synonyms')
        query = get_create_synonym_relationships_query(NODE_STRING, PROP_ID, PROP_ID, PROP_NAME)
        database.load_csv_file(file, headers, query, 0, '\t', 2000, [PROP_ID])

        logging.info('add STRING - NCBI Gene link')
        file = os.path.join(self.output_dir, 'string2gene.tsv')
        headers = [PROP_ID, 'gene_id']
        query = get_create_relationships_query(NODE_STRING, PROP_ID, PROP_ID, NODE_GO, PROP_ID, 'gene_id', REL_GENE)
        database.load_csv_file(file, headers, query, 0, '\t', 2000, ['gene_id'])


