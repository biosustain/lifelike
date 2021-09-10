import csv
import os

from datetime import datetime, timedelta

from azure.storage.fileshare import generate_file_sas, ShareFileClient, AccountSasPermissions

from common.database import get_database, Database
from common.utils import get_data_dir
from cloudstorage.azure_cloud_storage import AzureCloudStorage


"""File is used to execute generic queries and create
a TSV data file.

The data file is then uploaded to a cloud storage (e.g Azure),
where the migration will pull from and use.
"""
def create_data_file(db: Database, filepath: str, query: str):
    with open(filepath, 'w', newline='\n') as tsvfile:
        results = db.get_data(query)
        writer = csv.writer(tsvfile, delimiter='\t', quotechar='"')
        writer.writerow(['node_id', 'entity_type'])
        for index, row in results.iterrows():
            if not row.is_global:
                writer.writerow([row.node_id, row.node_labels])
            else:
                if len(row.node_labels) > 1:
                    writer.writerow([row.node_id, [l for l in row.node_labels if l != row.edge_entity_type]])
                else:
                    writer.writerow([row.node_id, row.node_labels])


def azure_upload(filepath: str, filename: str):
    sas_token = generate_file_sas(
        account_name=os.environ.get('AZURE_ACCOUNT_STORAGE_NAME'),
        account_key=os.environ.get('AZURE_ACCOUNT_STORAGE_KEY'),
        permission=AccountSasPermissions(write=True),
        share_name='knowledge-graph',
        file_path=[filename],
        expiry=datetime.utcnow() + timedelta(hours=1))
    azure = ShareFileClient(
        account_url=f"https://{os.environ.get('AZURE_ACCOUNT_STORAGE_NAME')}.file.core.windows.net",
        credential=sas_token,
        share_name='knowledge-graph',
        file_path=filename,
        logging_enable=True)
    cloudstorage = AzureCloudStorage(azure)
    cloudstorage.upload(filepath, filename)
    azure.close_all_handles()


if __name__ == '__main__':
    db = get_database()
    filename = 'LL_3625_add_entity_type_array.tsv'
    filepath = os.path.join(get_data_dir(), filename)
    query = """
    MATCH (n:db_MESH)-[r:HAS_SYNONYM]-(s:Synonym)
    WITH n, r, [l IN labels(n) WHERE NOT l IN ['db_MESH', 'TopicalDescriptor', 'TreeNumber']] AS labels WHERE size(labels) >= 1
    RETURN DISTINCT id(n) AS node_id, labels AS node_labels,
        exists(r.global_inclusion) AS is_global, r.entity_type AS edge_entity_type
    """
    create_data_file(db, filepath, query)
    azure_upload(filepath, filename)
