import csv
import os

from collections import defaultdict
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

        # a node could have 2+ entity labels (rare)
        # but at the same time, a global inclusion could've
        # been made by mistake
        #
        # if node_id: list(is_global) are all false
        # then safe to assume node has valid 2+ entity labels
        node_id_global = defaultdict(set)
        node_id_labels = {}
        node_id_edge_entity_type = defaultdict(set)
        for index, row in results.iterrows():
            node_id_global[row.node_id].add(row.is_global)
            node_id_labels[row.node_id] = row.node_labels
            node_id_edge_entity_type[row.node_id] = node_id_edge_entity_type[row.node_id].union(
                set(entity_type for entity_type in row.edge_entity_types))

        del results

        for node_id, global_set in node_id_global.items():
            if True not in global_set:
                writer.writerow([node_id, ','.join(label for label in node_id_labels[node_id])])
            else:
                if len(node_id_labels[node_id]) == 1:
                    writer.writerow([node_id, ','.join(label for label in node_id_labels[node_id])])
                else:
                    writer.writerow([node_id, ','.join(
                        label for label in set(node_id_labels[node_id]) - node_id_edge_entity_type[node_id])])


def azure_upload(filepath: str, filename: str, zip_filename: str, zip_filepath: str):
    sas_token = generate_file_sas(
        account_name=os.environ.get('AZURE_ACCOUNT_STORAGE_NAME'),
        account_key=os.environ.get('AZURE_ACCOUNT_STORAGE_KEY'),
        permission=AccountSasPermissions(write=True),
        share_name='knowledge-graph',
        file_path=['migration', zip_filename],
        expiry=datetime.utcnow() + timedelta(hours=1))
    azure = ShareFileClient(
        account_url=f"https://{os.environ.get('AZURE_ACCOUNT_STORAGE_NAME')}.file.core.windows.net",
        credential=sas_token,
        share_name='knowledge-graph',
        file_path=f'migration/{zip_filename}',
        logging_enable=True)
    cloudstorage = AzureCloudStorage(azure)
    cloudstorage.upload(filepath, filename, zip_filename, zip_filepath)
    azure.close_all_handles()


if __name__ == '__main__':
    db = get_database()
    filename = 'jira-LL-3625-add-entity-type-array-protein.tsv'
    filepath = os.path.join(get_data_dir(), filename)
    zip_filename = 'jira-LL-3625-add-entity-type-array-protein.zip'
    zip_filepath = os.path.join(get_data_dir(), zip_filename)
    query = """
    MATCH (n:Protein)-[r:HAS_SYNONYM]-(s:Synonym)
    WITH n, r, s, [l IN labels(n) WHERE NOT l starts WITH 'db_' AND NOT l IN ['Complex', 'GlobalInclusion']] as entityLabel
    WHERE size(entityLabel) >= 1
    RETURN DISTINCT id(n) AS node_id, entityLabel AS node_labels,
        exists(r.global_inclusion) AS is_global, collect(DISTINCT r.entity_type) AS edge_entity_types
    """
    create_data_file(db, filepath, query)
    azure_upload(filepath, filename, zip_filename, zip_filepath)
