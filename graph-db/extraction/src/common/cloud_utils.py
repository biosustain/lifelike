from cloudstorage.azure_cloud_storage import AzureCloudStorage

def azure_upload(filepath: str, filename: str):
    sas_token = AzureCloudStorage.generate_token(filename)
    cloudstorage = AzureCloudStorage(AzureCloudStorage.get_file_client(sas_token, filename))
    cloudstorage.upload(filepath, filename)
    cloudstorage.close()
