import os
from google.cloud import storage

storage_client = storage.Client()
bucket_name = 'lmdb_database'
bucket = storage_client.bucket(bucket_name)

blobs = storage_client.list_blobs(bucket_name)
databases = set([b.name.split('/')[0] for b in blobs])

if not os.path.exists('lmdb'):
    os.makedirs('lmdb')
    for database in databases:
        os.makedirs(f'lmdb/{database}')

for database in databases:
    print(f'Downloading LMDB files for {database}...')
    data_mdb = f'{database}/data.mdb'
    lock_mdb = f'{database}/lock.mdb'
    data_mdb_blob = bucket.blob(data_mdb)
    lock_mdb_blob = bucket.blob(lock_mdb)
    data_mdb_blob.download_to_filename(
        os.path.join('lmdb', database, 'data.mdb'))
    lock_mdb_blob.download_to_filename(
        os.path.join('lmdb', database, 'lock.mdb'))

print('Finished downloading LMDB databases.')
