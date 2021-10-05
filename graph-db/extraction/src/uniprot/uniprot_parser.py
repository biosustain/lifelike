from common.base_parser import BaseParser
from common.constants import *
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
        self.id: str = ''
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
        if name:
            self.proteinNames.append((type, name))

    def get_all_names(self):
        names = []
        for item in self.proteinNames:
            names.append(item[1])
        return names

    def get_synonym_rows(self):
        s = ''
        for item in self.proteinNames:
            s += f'{self.id}\t{item[1]}\t{item[0]}\n'
        return s

    def get_alternative_accession_rows(self):
        s = ''
        for item in self.other_accessions:
            s += f'{self.id}\t{item}\n'
        return s

    def get_go_rows(self):
        s = ''
        for k in self.go_ids:
            go_id = k.replace('GO:', '')
            s += f'{self.id}\t{go_id}\n'
        return s


class UniprotParser(BaseParser):
    def __init__(self, base_dir=None):
        BaseParser.__init__(self, DB_UNIPROT.lower(), base_dir)
        self.uniprot_file = 'uniprot_sprot.dat.gz'
        self.id_mapping_file = 'idmapping_selected.tab.gz'
        self.logger = logging.getLogger(__name__)

    def parse_uniprot_file(self):
        entries = []
        self.logger.info("Start parsing file:" + self.uniprot_file)
        with gzip.open(os.path.join(self.download_dir, self.uniprot_file), 'rt') as f:
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
                elif line.startswith('AC'):
                    line = line[3:].strip().strip(';')
                    items = re.split(';\s*', line)
                    # currently we are not storing other accession in neo4j. Could be useful in the future if we need to use it
                    if not entry.id:
                        entry.id = items[0]
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
        self.logger.info(f'Total entries: {len(entries)}')
        return entries

    def _clean_name(self, text:str, clean_brace=True):
        item = text.split(';')[0]
        if clean_brace and '{' in item:
            item = item[:item.find('{')]
        return item.strip()

    def parse_and_write_data_files(self):
        entries = self.parse_uniprot_file()
        self.write_protein_file(entries)
        self.write_protein2synonym_file(entries)
        self.write_protein2go_file(entries)
        self.parse_and_write_sprot2gene_file()
        self.extract_protein_symbol_as_synonym()
        self.extract_multiple_genes_from_sprot2gene()

    def write_protein_file(self, entries):
        self.logger.info("write sprot.tsv")
        with open(os.path.join(self.output_dir, 'sprot.tsv'), 'w') as f:
            f.write('\t'.join([PROP_ID, PROP_NAME, PROP_GENE_NAME, PROP_TAX_ID, PROP_PATHWAY, PROP_FUNCTION]) + '\n')
            f.writelines('\t'.join([entry.id, entry.name, entry.gene_name, entry.tax_id, entry.pathway, entry.function])+'\n' for entry in entries)

    def write_protein2synonym_file(self, entries):
        self.logger.info("write sprot2syn")
        names = set()
        for entry in entries:
            names.update(entry.get_all_names())
        with open(os.path.join(self.output_dir, 'sprot2syn.tsv'), 'w') as f:
            f.write('\t'.join([PROP_ID, PROP_NAME, PROP_TYPE]) + '\n')
            f.writelines(entry.get_synonym_rows() for entry in entries)

    def write_protein2go_file(self, entries):
        self.logger.info("write sprot2go")
        with open(os.path.join(self.output_dir, 'sprot2go.tsv'), 'w') as f:
            f.write(f'{PROP_ID}\t{PROP_GO_ID}\n')
            f.writelines(entry.get_go_rows() for entry in entries)

    def parse_and_write_sprot2gene_file(self):
        self.logger.info("write sprot2gene")
        # get sprot ids
        df = pd.read_table(os.path.join(self.output_dir, 'sprot.tsv'))
        sprot_ids = set([id for id in df[PROP_ID]])

        with gzip.open(os.path.join(self.download_dir, self.id_mapping_file), 'rt') as f,\
                open(os.path.join(self.output_dir, 'sprot2gene.tsv'), 'w') as outfile:
            outfile.write(f'{PROP_ID}\t{PROP_GENE_ID}\n')
            rows = 0
            lines = 0
            for line in f:
                lines += 1
                if len(line) > 10000:
                    # some rows are too long, truncate it as we only need the first two columns
                    line = line[:1000]
                row = line.split('\t')
                if len(row) < 2:
                    break
                if row[2] and row[0] in sprot_ids:
                    rows += 1
                    outfile.write(f'{row[0]}\t{row[2]}\n')
        self.logger.info('finished writing sprot2gene.tsv. rows:' + str(rows))

    def extract_multiple_genes_from_sprot2gene(self):
        self.logger.info('split gene_id columns when values have multiple gene ids')
        df = pd.read_table(os.path.join(self.output_dir, 'sprot2gene.tsv'))
        print('sprot2gene:', len(df))
        df_m = df[df[PROP_GENE_ID].str.contains(';')]
        df = df[~df[PROP_GENE_ID].str.contains(';')]
        print('sprot2gene with multiple genes:', len(df_m), 'single gene:', len(df))
        df_m.set_index(PROP_ID, inplace=True)
        df_m = df_m[PROP_GENE_ID].str.split(';', expand=True).stack()
        df_m = df_m.reset_index().rename(columns={0: PROP_GENE_ID})
        df_m[PROP_GENE_ID] = df_m[PROP_GENE_ID].str.strip()
        df_m = df_m[[PROP_ID, PROP_GENE_ID]]
        print('split genes:', len(df_m))
        df = pd.concat([df, df_m])
        print(len(df))
        df.to_csv(os.path.join(self.output_dir, 'sprot2gene2.tsv'), index=False, sep='\t')

    def extract_protein_symbol_as_synonym(self):
        self.logger.info("extract protein symbol")
        '''
        Check protein names for the last word. If it matches with gene_name (case insensitive), and it is not the same as protein name, add as a new synonym
        :return: file with columns for protein_id and names derived from gene_name
        '''
        df_prot = pd.read_table(os.path.join(self.output_dir, 'sprot.tsv'), usecols= [PROP_ID, PROP_GENE_NAME])
        print(len(df_prot))
        df_syn = pd.read_table(os.path.join(self.output_dir, 'sprot2syn.tsv'))
        print(len(df_syn))
        df_syn = df_syn.dropna()
        print(len(df_syn))
        df_syn = df_syn[df_syn[PROP_NAME].str.contains(' ')]
        df_syn['symbol'] = df_syn[PROP_NAME].str.split(' ').str[-1]
        df_syn.set_index(PROP_ID)
        df = df_syn.merge(df_prot, on=PROP_ID)
        df = df[(df['symbol'] != df[PROP_GENE_NAME]) & (df['symbol'].str.lower() == df[PROP_GENE_NAME].str.lower())]
        self.logger.info(f'symbol synonyms:{len(df)}')
        df = df[[PROP_ID, 'symbol']]
        df.columns = [PROP_ID, PROP_NAME]
        df[PROP_TYPE] = 'extracted protein symbol'
        df.to_csv(os.path.join(self.output_dir, 'sprot2syn_derived.tsv'), sep='\t', index=False)


if __name__ == '__main__':
    parser = UniprotParser('/Users/rcai/data')
    parser.parse_and_write_data_files()



