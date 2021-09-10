import logging
import os
import sys

from azure.storage.fileshare import ShareFileClient


class CloudStorage:
    def __init__(self, provider: ShareFileClient) -> None:
        self.provider = provider
        self.logger = logging.getLogger('azure.storage.fileshare')
        self.logger.setLevel(logging.INFO)
        _handler = logging.StreamHandler(stream=sys.stdout)
        self.logger.addHandler(_handler)

    def _delete_local_file(self, filepath: str) -> None:
        os.remove(filepath)

    def upload(self, filepath: str, filename: str) -> None:
        raise NotImplementedError
