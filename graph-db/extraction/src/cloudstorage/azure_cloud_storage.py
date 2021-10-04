import hashlib
import os

from datetime import datetime, timedelta
from zipfile import ZipFile

from azure.storage.fileshare import (
    generate_file_sas,
    AccountSasPermissions,
    ContentSettings,
    ShareFileClient
)

from .cloud_storage import CloudStorage


class AzureCloudStorage(CloudStorage):
    """Class to interface with Azure.

    How to use:
        sas_token = AzureCloudStorage.generate_token(filename)
        cloudstorage = AzureCloudStorage(AzureCloudStorage.get_file_client(sas_token, filename))
        cloudstorage.upload(filepath, filename)
        cloudstorage.close()
    """
    def __init__(self, provider: ShareFileClient):
        super().__init__(provider)

    @staticmethod
    def generate_token(filename: str):
        zipfilename = filename.replace('.tsv', '.zip')
        return generate_file_sas(
            account_name=os.environ.get('AZURE_ACCOUNT_STORAGE_NAME'),
            account_key=os.environ.get('AZURE_ACCOUNT_STORAGE_KEY'),
            permission=AccountSasPermissions(write=True),
            share_name='knowledge-graph',
            file_path=['migration', zipfilename],
            expiry=datetime.utcnow() + timedelta(hours=1)
        )

    @staticmethod
    def get_file_client(token, filename: str):
        zipfilename = filename.replace('.tsv', '.zip')
        return ShareFileClient(
            account_url=f"https://{os.environ.get('AZURE_ACCOUNT_STORAGE_NAME')}.file.core.windows.net",
            credential=token,
            share_name='knowledge-graph',
            file_path=f'migration/{zipfilename}',
            logging_enable=True
        )

    def close(self):
        self.provider.close_all_handles()

    def upload(self, filename: str, filepath: str) -> None:
        zipfilename = filename.replace('.tsv', '.zip')
        zipfilepath = filepath.replace('.tsv', '.zip')

        with open(filepath, 'rb') as sourcefile:
            hash_fn = hashlib.md5()
            while chunk := sourcefile.read(8192):
                hash_fn.update(chunk)
            checksum = hash_fn.digest()
            self.logger.info(f'Uploading file "{zipfilename}"; content checksum as string: "{hash_fn.hexdigest()}"')

        with ZipFile(zipfilepath, 'w') as zipfile:
            zipfile.write(filepath, arcname=filename)

        with open(zipfilepath, 'rb') as zipfile:
            self.provider.upload_file(zipfile, content_settings=ContentSettings(content_md5=checksum))

        self._delete_local_file(filepath)
        self._delete_local_file(zipfilepath)
