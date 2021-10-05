import os, gzip

from common.cloud_utils import azure_upload
from common.utils import get_data_dir


class BaseParser:
    REL_LABEL_COL = 'REL_TYPE'
    NODE_LABEL_COL = 'NODE_LABEL'
    IGNORE = ':IGNORE'

    def __init__(self, data_dir_name, base_dir: str = None):
        if not base_dir:
            base_dir = get_data_dir()
        self.base_dir = base_dir
        self.download_dir = os.path.join(self.base_dir, 'download', data_dir_name)
        self.output_dir = os.path.join(self.base_dir, 'processed', data_dir_name)
        os.makedirs(self.output_dir, 0o777, True)

    def output_sample_import_file(self):
        """
        This is for exam data only.  Some files are too big to view.
        Read all files in the download folder and write the fist 5000 lines to a .s file
        """
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

    def upload_azure_file(self, filename: str, fileprefix: str):
        azure_upload(os.path.join(self.output_dir, filename), f'jira-{fileprefix}-{filename}')
