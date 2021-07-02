from common.base_parser import BaseParser
from common.constants import *
from common.database import *
from common.query_builder import *
import os, gzip, logging, re, csv
import pandas as pd

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s',
                    handlers=[logging.StreamHandler()])


# protein name types:
REC_FULLNAME = 'recommended full name'
REC_SHORTNAME = 'recommended short name'
ALT_FULLNAME = 'alternative full name'
ALT_SHORTNAME = 'alternative short name'


GO_TYPES = {'F': 'FUNCTION',
            'C': 'COMPONENT',
            'P': 'PROCESS'
            }

ANNOT_SYNONYM = 'annotated from gene name'

class Entry(object):
    def __init__(self):
        self.accession: str = ''
        self.other_accessions = []
        self.name: str = ''
        self.gene_name: str = ''
        self.dataset: str = 'Swiss-Prot'
        self.proteinNames = []  # list of tuple (type, name)
        self.tax_id: str = ''
        self.function = ''
        self.pathway = ''
        self.go_ids = []

    def add_protein_name(self, type, name):
        self.proteinNames.append((type, name))

    def get_all_names(self):
        names = []
        for item in self.proteinNames:
            names.append(item[1])
        return names

    def get_synonym_rows(self, show_name=False):
        s = ''
        for item in self.proteinNames:
            if show_name:
                s += f'{self.accession}\t{self.name}\t{item[1]}\t{item[0]}\t{self.tax_id}\n'
            else:
                s += f'{self.accession}\t{item[1]}\t{item[0]}\n'
        return s

    def get_alternative_accession_rows(self):
        s = ''
        for item in self.other_accessions:
            s += f'{self.accession}\t{item}\n'
        return s

    def get_go_rows(self, go_set: set):
        s = ''
        for k in self.go_ids:
            if k in go_set:
                s += f'{self.accession}\t{k}\n'
        return s


class UniprotParser(BaseParser):
    """
    This parser could be improved by removing the file writing part, and update database after parsing the files
    """
    def __init__(self, base_dir=None):
        BaseParser.__init__(self, DB_UNIPROT.lower())

    def parse_uniprot_file(self, gz_file: str):
        entries = []
        logging.info('start parsing file:' + gz_file)
        with gzip.open(os.path.join(self.download_dir, gz_file), 'rt') as f:
            for line in f:
                if not line.startswith('CC       '):
                    function = False
                    pathway = False
                if line.startswith('ID'):
                    if entries and len(entries) % 10000 == 0:
                        logging.info(str(len(entries)))
                    entry = Entry()
                    pre_line_type = None
                    entries.append(entry)
                    entry.name = line[3:].strip().split(' ')[0]
                    if entry.name == '2A51_CAEEL':
                        print('check this gene')
                elif line.startswith('AC'):
                    line = line[3:].strip().strip(';')
                    items = re.split(';\s*', line)
                    if not entry.accession:
                        entry.accession = items[0]
                        if len(items) > 1:
                            entry.other_accessions = entry.other_accessions + items[1:]
                    else:
                        entry.other_accessions = entry.other_accessions + items
                elif line.startswith('DE'):
                    text = line[3:].strip()
                    if text.startswith('RecName: Full='):
                        entry.add_protein_name(REC_FULLNAME, self._clean_name(text[len('RecName: Full='):]))
                        pre_line_type = 'RecName'
                    elif text.startswith('AltName: Full='):
                        entry.add_protein_name(ALT_FULLNAME, self._clean_name(text[len('AltName: Full='):]))
                        pre_line_type = 'AltName'
                    elif text.startswith('Short='):
                        if pre_line_type == 'RecName':
                            entry.add_protein_name(REC_SHORTNAME, self._clean_name(text[len('Short='):]))
                        elif pre_line_type == 'AltName':
                            entry.add_protein_name(ALT_SHORTNAME, self._clean_name(text[len('Short='):]))
                elif line.startswith('OX   NCBI_TaxID='):
                    entry.tax_id = self._clean_name(line[len('OX   NCBI_TaxID='):])
                elif line.startswith('GN   Name='):
                    entry.gene_name = self._clean_name(line[len('GN   Name='):])
                elif line.startswith('DR   GO;'):
                    entry.go_ids.append(self._clean_name(line[len('DR   GO;'):]))
                elif line.startswith('CC   -!- FUNCTION:'):
                    function = True
                    entry.function = self._clean_name(line[len('CC   -!- FUNCTION:'):], False)
                elif line.startswith('CC   -!- PATHWAY:'):
                    pathway = True
                    if entry.pathway:
                        entry.pathway += '; '
                    entry.pathway += self._clean_name(line[len('CC   -!- PATHWAY:'):], False)
                elif line.startswith('CC       '):
                    if function:
                        entry.function += ' ' + self._clean_name(line[len('CC       '):], False)
                    elif pathway:
                        entry.pathway += ' ' + self._clean_name(line[len('CC       '):], False)
        logging.info(f'total entries: {len(entries)}')
        return entries

    def write_data_files_for_import(self):
        entries = self.parse_uniprot_file('uniprot_sprot.dat.gz')
        self.write_protein_file(entries)
        self.write_protein2synonym_file(entries)
        self.write_protein2go_file(entries)
        self.write_sprot2gene_file()
        # write primary accession to alternative acessions
        # with open(os.path.join(self.output_dir, 'access2alt.tsv'), 'w') as f:
        #     f.writelines(entry.get_alternative_accession_rows() for entry in entries)

    def write_protein_file(self, entries):
        with open(os.path.join(self.output_dir, 'sprot.tsv'), 'w') as f:
            f.writelines(f'{entry.accession}\t{entry.name}\t{entry.gene_name}\t{entry.tax_id}\t"{entry.pathway}"\t"{entry.function}"\n' for entry in entries)

    def write_protein2synonym_file(self, entries):
        names = set()
        for entry in entries:
            names.update(entry.get_all_names())
        with open(os.path.join(self.output_dir, 'synonym.tsv'), 'w') as f:
            f.writelines(name + '\n' for name in names)
        with open(os.path.join(self.output_dir, 'sprot2syn.tsv'), 'w') as f:
            f.writelines(entry.get_synonym_rows() for entry in entries)

    def write_protein2go_file(self, entries):
        with open(os.path.join(self.base_dir, 'processed', 'go', 'go.tsv'), 'r') as f:
            reader = csv.reader(f, delimiter='\t')
            go_set = set([row[0] for row in reader])
        with open(os.path.join(self.output_dir, 'sprot2go.tsv'), 'w') as f:
            f.writelines(entry.get_go_rows(go_set) for entry in entries)

    def write_header_files_for_import(self):
        with open(os.path.join(self.output_dir, 'sprot_header.tsv'), 'w') as f:
            f.write('id:ID(UniProt-ID)\tname\tgene_name\t:IGNORE\tpathway\tfunction\n')
        with open(os.path.join(self.output_dir, 'sprot2tax_header.tsv'), 'w') as f:
            f.write(':START_ID(UniProt-ID)\t:IGNORE\t:IGNORE\t:END_ID(Taxonomy-ID)\t:IGNORE\t:IGNORE\n')
        with open(os.path.join(self.output_dir, 'synonym_header.tsv'), 'w') as f:
            f.write('name:ID(Synonym-ID)\n')
        with open(os.path.join(self.output_dir, 'sprot2syn_header.tsv'), 'w') as f:
            f.write(':START_ID(UniProt-ID)\t:END_ID(Synonym-ID)\ttype\n')
        with open(os.path.join(self.output_dir, 'sprot2gene_header.tsv'), 'w') as f:
            f.write(':START_ID(UniProt-ID)\t:END_ID(Gene-ID)\n')
        with open(os.path.join(self.output_dir, 'sprot2go_header.tsv'), 'w') as f:
            f.write(':START_ID(UniProt-ID)\t:END_ID(GO-ID)\n')

    def write_sprot2gene_file(self):
        logging.info("write sprot2gene")
        # get sprot ids
        with open(os.path.join(self.output_dir, 'sprot.tsv'), 'r') as f:
            sprot_ids = set([line.split('\t')[0] for line in f])
        logging.info("total sprot " + str(len(sprot_ids)))
        # with open(os.path.join(self.base_dir, 'processed', 'gene', 'gene.tsv'), 'r') as f:
        #     reader = csv.reader(f, delimiter='\t')
        #     genes = set([row[0] for row in reader])
        with gzip.open(os.path.join(self.download_dir, 'idmapping_selected.tab.gz'), 'rt') as f,\
                open(os.path.join(self.output_dir, 'sprot2gene.tsv'), 'w') as outfile:
            rows = 0
            lines = 0
            for line in f:
                lines += 1
                if len(line) > 10000:
                    line = line[:1000]
                row = line.split('\t')
                if len(row) < 2:
                    break
                if row[2] and row[0] in sprot_ids:
                    rows += 1
                    outfile.write(f'{row[0]}\t{row[2]}\n')
        logging.info('finished writing sprot2gene.tsv. rows:' + str(rows))

    def remove_gene_mesh_from_synonym_file(self):
        ## get gene synonyms
        with open(os.path.join(self.base_dir, 'processed', 'gene', 'synonym.tsv'), 'r') as f:
            excluded_terms = set([line for line in f])
        with open(os.path.join(self.base_dir, 'processed', 'mesh', 'synonym.tsv'), 'r') as f:
            excluded_terms.update([line for line in f])
        with open(os.path.join(self.base_dir, 'processed', 'go', 'synonym.tsv'), 'r') as f:
            excluded_terms.update([line for line in f])
        with open(os.path.join(self.output_dir, 'synonym.tsv'), 'r') as f, open(os.path.join(self.output_dir, 'synonym_no_gene_mesh_go.tsv'), 'w') as f2:
            f2.writelines(line for line in f if line not in excluded_terms)

    def extract_protein_symbol_as_synonym(self):
        '''
        Check protein names for the last word. If it matches with gene_name (case insensitive), and it is not the same as protein name, add as a new synonym
        :return: file with columns for protein_id and names derived from gene_name
        '''
        filename = os.path.join(self.output_dir, 'sprot2syn_derived.tsv')
        filename2 = os.path.join(self.output_dir, 'sprot2syn_gene.tsv')
        prot2gene_dict = dict()
        with open(os.path.join(self.output_dir, 'sprot.tsv'), 'r') as f:
            for line in f:
                row = line.split('\t')
                prot_id = row[0]
                gene_name = row[2]
                if gene_name:
                    prot2gene_dict[prot_id] = gene_name
        prot_processed = set()
        with open(os.path.join(self.output_dir, 'sprot2syn.tsv'), 'r') as f, open(filename, 'w') as outfile, open(filename2, 'w') as outfile2:
            count = 0
            outfile2.write('prot_id\tsynonym\tgene_name\n')
            for line in f:
                row = line.split('\t')
                prot_id = row[0]
                if not prot_id in prot_processed and prot_id in prot2gene_dict:
                    name = row[1].strip()
                    syn = name.split(' ')[-1]
                    gene_name = prot2gene_dict[prot_id]
                    if syn == name or syn == gene_name:
                        # syn already in the name list, or same as gene name, skip
                        prot_processed.add(prot_id)
                    elif syn.lower() == gene_name.lower():
                        count += 1
                        prot_processed.add(prot_id)
                        outfile.write(f'{prot_id}\t{syn}\t{ANNOT_SYNONYM}\n')
                        outfile2.write(f'{prot_id}\t{syn}\t{gene_name}\n')
            print('added synonyms: ', count)

    def load_data_to_neo4j(self, database: Database, update=True):
        file = os.path.join(self.output_dir, 'sprot.tsv')
        headers = [PROP_ID, PROP_NAME, 'gene_name', 'tax_id', 'pathway', 'function']
        query = get_update_nodes_query(NODE_UNIPROT, PROP_ID, headers, [NODE_PROTEIN])
        database.load_csv_file(file, headers, query, 0, '\t', 2000, ['tax_id'])
        # load synonyms
        file = os.path.join(self.output_dir, 'synonym.tsv')
        headers = [PROP_NAME]
        query = get_create_nodes_query(NODE_SYNONYM, PROP_NAME, [])
        database.load_csv_file(file, headers, query, 0, '\t', 2000)

        # load protein-synonym relationship
        file = os.path.join(self.output_dir, 'sprot2syn.tsv')
        headers = [PROP_ID, 'synonym', 'type']
        query = get_create_relationships_query(NODE_TAXONOMY, PROP_ID, PROP_ID, NODE_SYNONYM, PROP_NAME, 'synonym',
                                                    REL_SYNONYM, ['type'])
        database.load_csv_file(file, headers, query, 0, '\t', 2000)

        # load protein2taxonomy relationship
        file = os.path.join(self.output_dir, 'sprot.tsv')
        headers = [PROP_ID, PROP_NAME, 'gene_name', 'tax_id', 'pathway', 'function']
        query = get_create_relationships_query(NODE_UNIPROT, PROP_ID, PROP_ID, NODE_TAXONOMY,
                                                          PROP_ID, 'tax_id', REL_TAXONOMY)
        database.load_csv_file(file, headers, query, 0, '\t', 2000, ['tax_id'])

        # load sprot2go relationship
        file = os.path.join(self.output_dir, 'sprot2go.tsv')
        headers = [PROP_ID, 'go_id']
        query = get_create_relationships_query(NODE_UNIPROT, PROP_ID, PROP_ID, NODE_GO,
                                                          PROP_ID, 'go_id', REL_GO_LINK)
        database.load_csv_file(file, headers, query, 0, '\t', 2000)

        # load sprot2gene relationship
        file = os.path.join(self.output_dir, 'sprot2gene.tsv')
        headers = [PROP_ID, 'gene_id']
        query = get_create_relationships_query(NODE_UNIPROT, PROP_ID, PROP_ID, NODE_GENE,
                                                          PROP_ID, 'gene_id', REL_GENE)
        database.load_csv_file(file, headers, query, 0, '\t', 2000)

    def fix_missed_genelinks(self, database):
        """
        Some gene_id columns in sprot2gene.tsv has more than one id's separated by ';'.  Those rows were failed to load into neo4j
        :return:
        """
        file = os.path.join(self.output_dir, 'sprot2gene.tsv')
        df = pd.read_csv(file, sep='\t', header=None, names=['uniprot_id', 'gene_id'])
        df_filtered = df[df['gene_id'].str.find(';')>0]
        print('total rows:', len(df), ' filtered rows:', len(df_filtered))
        df_missed = df_filtered.set_index(df.columns.drop('gene_id', 1).tolist()).gene_id.str.split(';', expand=True).stack()
        df_missed = df_missed.reset_index().rename(columns={0: 'gene_id'}).loc[:, df.columns]
        df_missed['gene_id'] = df_missed['gene_id'].str.strip()
        df_missed.to_csv(os.path.join(self.output_dir, 'missed_link.tsv'), sep='\t', index=False)
        query = get_create_relationships_query(NODE_UNIPROT, PROP_ID, 'uniprot_id',
                                               NODE_GENE, PROP_ID, 'gene_id', REL_GENE)
        database.load_data_from_dataframe(df_missed, query, 5000)

    def get_swissprot_ids(self) -> set:
        """
        Get swissprot protein id set for lookups
        :return: set of uniprot ids
        """
        file = os.path.join(self.output_dir, 'sprot.tsv')
        df = pd.read_csv(file, sep='\t', header=None, names=['id', 'name', 'gene', 'tax_id'])
        ids = set([pid for pid in df['id']])
        return ids

    def _clean_name(self, text:str, clean_brace=True):
        item = text.split(';')[0]
        if clean_brace and '{' in item:
            item = item[:item.find('{')]
        return item.strip()

    def add_protein_symbol_as_synonym(self, database):
        self.extract_protein_symbol_as_synonym()
        filename = os.path.join(self.output_dir, 'sprot2syn_derived.tsv')
        headers = ['prot_id', 'synonym', 'type']
        query = get_create_synonym_relationships_query(NODE_UNIPROT, PROP_ID, 'prot_id', 'synonym', ['type'])
        database.create_index(NODE_UNIPROT, PROP_ID)
        database.create_index(NODE_SYNONYM, PROP_NAME)
        database.load_csv_file(filename, headers, query, 0, '\t', 2000)

    @classmethod
    def add_name_as_synonym(cls, database:Database):
        query = "match (n:db_UniProt) merge (s:Synonym {name:n.name}) merge (n)-[:HAS_SYNONYM]->(s)"
        database.run_query(query)

    @classmethod
    def add_name_as_synonym(cls, database: Database):
        query = "match (n:db_UniProt) merge (s:Synonym {name:n.name}) merge (n)-[:HAS_SYNONYM]->(s)"
        database.run_query(query)


if __name__ == '__main__':
    parser = UniprotParser()
    database = get_database(Neo4jInstance.LOCAL)
    parser.load_data_to_neo4j(database)
    database.close()

