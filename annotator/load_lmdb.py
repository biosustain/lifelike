import os

from lmdb_manager.manager import AzureStorageProvider, LMDBManager

if __name__ == '__main__':
    manager = LMDBManager(AzureStorageProvider(), 'lmdb')
    lmdb_dir_path = os.path.join(os.getcwd(), 'app/services/lmdb')
    manager.download_all(lmdb_dir_path)
    manager.update_all_dates(lmdb_dir_path)
