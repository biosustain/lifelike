from common.constants import *
from common.base_parser import BaseParser
from common.database import *
from common.utils import get_data_dir
import logging

from create_data_file import azure_upload


class KeggParser(BaseParser):
    def __init__(self, basedir=None):
        BaseParser.__init__(self, DB_KEGG.lower(), basedir)
        self.logger = logging.getLogger(__name__)

    def parse_pathway_file(self):
        file = os.path.join(self.download_dir, 'pathway', 'pathway.list')
        df = pd.read_csv(file, sep='\t', names=[PROP_ID, PROP_NAME])
        df = df[~df[PROP_ID].str.startswith('#')]
        return df

    def parse_ko_file(self):
        ENTRY = 'ENTRY'
        NAME = PROP_NAME.upper()
        DEF = PROP_DEF.upper()

        file = os.path.join(self.download_dir, 'genes', 'ko', 'ko')
        entries = []
        entry = {}
        with open(file, 'r') as f:
            for line in f:
                if line.startswith(ENTRY):
                    entry = dict()
                    entries.append(entry)
                    val = self.get_attr_value(ENTRY, line).split(' ')[0]
                    entry[PROP_ID] = val
                elif line.startswith(NAME):
                    entry[PROP_NAME] = self.get_attr_value(NAME, line)
                elif line.startswith(DEF):
                    entry[PROP_DEF] = self.get_attr_value(DEF, line)
        return pd.DataFrame(entries, columns=[PROP_ID, PROP_NAME, PROP_DEF])

    def parse_pathway2ko_file(self):
        file = os.path.join(self.download_dir, 'pathway', 'links', 'pathway_ko.list')
        df = pd.read_csv(file, sep='\t', header=None, names=['pathway', 'ko'])
        # print(len(df))
        df = df[df.pathway.str.contains('map')]
        df['pathway'] = df['pathway'].str.replace('path:map', '')
        df['ko'] = df['ko'].str.replace('ko:', '')
        return df

    def parse_pathway2genome_file(self):
        file = os.path.join(self.download_dir, 'pathway', 'links', 'pathway_genome.list')
        df = pd.read_csv(file, sep='\t', header=None, names=['pathway', 'genome'])
        # print(len(df))
        df['pathway'] = df.pathway.str.replace('[\D:]+', '', regex=True)
        df['genome'] = df.genome.str.replace('gn:', '')
        return df

    @classmethod
    def get_attr_value(self, attr_name, line):
        if line.startswith(attr_name):
            val = line[len(attr_name):].strip()
            return val
        return ''

    def parse_and_write_data_files(self):
        df_pathway = self.parse_pathway_file()
        filepath = os.path.join(self.output_dir, 'pathway_data.tsv')
        zipfilepath = os.path.join(self.output_dir, 'pathway_data.zip')
        logging.info('kegg pathways: ' + str(len(df_pathway)))
        df_pathway.to_csv(filepath, sep='\t', index=False)
        # upload to azure
        azure_upload(filepath, 'jira-LL-3216-pathway_data.tsv', 'jira-LL-3216-pathway_data.zip', zipfilepath)

        df_ko = self.parse_ko_file()
        filepath = os.path.join(self.output_dir, 'ko_data.tsv')
        zipfilepath = os.path.join(self.output_dir, 'ko_data.zip')
        logging.info('kegg ko: ' + str(len(df_ko)))
        df_ko.to_csv(filepath, sep='\t', index=False)
        # upload to azure
        azure_upload(filepath, 'jira-LL-3216-ko_data.tsv', 'jira-LL-3216-ko_data.zip', zipfilepath)

        # Write gene data file
        outfile = os.path.join(self.output_dir, 'gene_data.tsv')
        zipoutfile = os.path.join(self.output_dir, 'gene_data.zip')
        infile = os.path.join(self.download_dir, 'genes', 'genes_ncbi-geneid.list')
        header = True
        chunks = pd.read_csv(infile, sep='\t', chunksize=3000, header=None, names=[PROP_ID, 'gene_id'])
        total = 0
        # create a new outfile
        f = open(outfile, 'w')
        f.close()
        for chunk in chunks:
            total = total + len(chunk)
            chunk['gene_id'] = chunk['gene_id'].str.replace('ncbi-geneid:', '')
            chunk['genome'] = chunk[PROP_ID].str.split(':', 1, True)[0]
            chunk.to_csv(outfile, header=header, mode='a', sep='\t', index=False)
            header = False
        logging.info('total genes: ' + str(total))
        # upload to azure
        azure_upload(outfile, 'jira-LL-3216-gene_data.tsv', 'jira-LL-3216-gene_data.zip', zipoutfile)

        ko2pathway = self.parse_pathway2ko_file()
        filepath = os.path.join(self.output_dir, 'ko2pathway_data.tsv')
        zipfilepath = os.path.join(self.output_dir, 'ko2pathway_data.zip')
        logging.info('total ko2pathways: ' + str(len(ko2pathway)))
        ko2pathway.to_csv(filepath, sep='\t', index=False, columns=['ko', 'pathway'])
        # upload to azure
        azure_upload(filepath, 'jira-LL-3216-ko2pathway_data.tsv', 'jira-LL-3216-ko2pathway_data.zip', zipfilepath)

        filepath = os.path.join(self.output_dir, 'genome2pathway_data.tsv')
        zipfilepath = os.path.join(self.output_dir, 'genome2pathway_data.zip')
        genome2pathways = self.parse_pathway2genome_file()
        logging.info('total genome2pathways: ' + str(len(genome2pathways)))
        genome2pathways.to_csv(filepath, sep='\t', index=False, columns=['genome', 'pathway'])
        # upload to azure
        azure_upload(filepath, 'jira-LL-3216-genome2pathway_data.tsv', 'jira-LL-3216-genome2pathway_data.zip', zipfilepath)

        outfile = os.path.join(self.output_dir, 'gene2ko_data.tsv')
        zipoutfile = os.path.join(self.output_dir, 'gene2ko_data.zip')
        infile = os.path.join(self.download_dir, 'genes', 'ko', 'ko_genes.list')
        header = True
        chunks = pd.read_csv(infile, sep='\t', chunksize=3000, header=None, names=['ko', 'gene'])
        total = 0
        # create a new outfile
        f = open(outfile, 'w')
        f.close()
        for chunk in chunks:
            total = total + len(chunk)
            chunk['ko'] = chunk['ko'].str.replace('ko:', '')
            chunk.to_csv(outfile, header=header, columns=['gene', 'ko'], mode='a', sep='\t', index=False)
            header = False
        logging.info('total gene2ko: ' + str(total))
        # upload to azure
        azure_upload(outfile, 'jira-LL-3216-gene2ko_data.tsv', 'jira-LL-3216-gene2ko_data.zip', zipoutfile)


def main():
    parser = KeggParser(get_data_dir())
    parser.parse_and_write_data_files()


if __name__ == "__main__":
    main()
