import os, gzip
import pandas as pd
from common.database import Database


class BaseParser:
    REL_LABEL_COL = 'REL_TYPE'
    NODE_LABEL_COL = 'NODE_LABEL'
    IGNORE = ':IGNORE'

    def __init__(self, data_dir_name, base_dir: str = None):
        if not base_dir:
            base_dir = os.environ.get('BASE_DATA_DIR', '/Users/rcai/data/')
        self.base_dir = base_dir
        self.download_dir = os.path.join(self.base_dir, 'download', data_dir_name)
        self.output_dir = os.path.join(self.base_dir, 'processed', data_dir_name)
        os.makedirs(self.output_dir, 0o777, True)

    def set_database(self, database: Database):
        self.database = database

    def close_database(self):
        if self.database:
            self.database.close()

    def output_sample_import_file(self):
        for file in os.listdir(self.download_dir):
            if file.endswith('.gz'):
                inputfilename = os.path.join(self.download_dir, file)
                outfilename = os.path.join(self.download_dir, file.replace('.gz', '.s'))
                with gzip.open(inputfilename, 'rt') as input, open(outfilename, 'w') as output:
                    rowcnt = 0
                    for line in input:
                        output.write(line)
                        rowcnt += 1
                        if rowcnt > 5000:
                            break

    def parse_and_write_data_files(self):
        pass

    def create_indexes(self, database: Database):
        pass

    def load_data_to_neo4j(self, database: Database, update=True):
        pass







