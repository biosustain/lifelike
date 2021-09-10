import hashlib

from azure.storage.fileshare import ShareFileClient, ContentSettings

from .cloud_storage import CloudStorage


class AzureCloudStorage(CloudStorage):
    def __init__(self, provider: ShareFileClient):
        super().__init__(provider)

    def upload(self, filepath: str, filename: str) -> None:
        with open(filepath, 'rb') as sourcefile:
            hash_fn = hashlib.md5()
            while chunk := sourcefile.read(8192):
                hash_fn.update(chunk)
            checksum = hash_fn.digest()
            self.logger.info(f'Uploading file "{filename}"; file checksum as string: "{hash_fn.hexdigest()}"')
            sourcefile.seek(0)
            self.provider.upload_file(
                sourcefile, content_settings=ContentSettings(content_md5=checksum))

        self._delete_local_file(filepath)
