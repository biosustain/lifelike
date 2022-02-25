from cloudstorage.azure_cloud_storage import AzureCloudStorage


class CloudMixin:
    def upload_to_azure(self, filename: str, filepath: str, is_zip=False):
        sas_token = AzureCloudStorage.generate_token(filename)
        cloudstorage = AzureCloudStorage(AzureCloudStorage.get_file_client(sas_token, filename))
        cloudstorage.upload(filename, filepath, is_zip)
        cloudstorage.close()
