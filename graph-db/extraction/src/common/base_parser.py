import os

from common.cloud_utils import azure_upload
from common.utils import get_data_dir


class BaseParser:
    REL_LABEL_COL = 'REL_TYPE'
    NODE_LABEL_COL = 'NODE_LABEL'
    IGNORE = ':IGNORE'

    def __init__(self, file_prefix, data_dir_name, base_dir: str = None):
        if not base_dir:
            base_dir = get_data_dir()

        try:
            int(file_prefix.split('-')[1])
        except Exception:
            raise ValueError('The argument change_id_prefix must be the JIRA card number; e.g LL-1234')

        self.file_prefix = f'jira-{file_prefix}-'
        self.base_dir = base_dir
        self.download_dir = os.path.join(self.base_dir, 'download', data_dir_name)
        self.output_dir = os.path.join(self.base_dir, 'processed', data_dir_name)
        os.makedirs(self.output_dir, 0o777, True)

    def parse_and_write_data_files(self):
        raise NotImplementedError

    # def upload_azure_file(self, filename: str, fileprefix: str):
    #     prefixed_filename = fileprefix + filename
    #     if 'jira' not in prefixed_filename:
    #         prefixed_filename = f'jira-{fileprefix}-{filename}'
    #     azure_upload(prefixed_filename, os.path.join(self.output_dir, prefixed_filename))
