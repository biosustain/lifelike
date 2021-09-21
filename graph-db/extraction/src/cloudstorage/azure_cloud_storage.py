import hashlib

from zipfile import ZipFile

from azure.storage.fileshare import ShareFileClient, ContentSettings

from .cloud_storage import CloudStorage


class AzureCloudStorage(CloudStorage):
    def __init__(self, provider: ShareFileClient):
        super().__init__(provider)

    def upload(self, filepath: str, filename: str, zip_filename: str, zip_filepath: str) -> None:
        with open(filepath, 'rb') as sourcefile:
            hash_fn = hashlib.md5()
            while chunk := sourcefile.read(8192):
                hash_fn.update(chunk)
            checksum = hash_fn.digest()
            self.logger.info(f'Uploading file "{zip_filename}"; content checksum as string: "{hash_fn.hexdigest()}"')

        with ZipFile(zip_filepath, 'w') as zipfile:
            zipfile.write(filepath, arcname=filename)

        with open(zip_filepath, 'rb') as zipfile:
            self.provider.upload_file(
                zipfile, content_settings=ContentSettings(content_md5=checksum))

        self._delete_local_file(filepath)
        self._delete_local_file(zip_filepath)
