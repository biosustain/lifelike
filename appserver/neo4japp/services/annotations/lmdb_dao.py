import lmdb

from os import path, remove, walk


# reference to this directory
directory = path.realpath(path.dirname(__file__))


class LMDBDao:
    def __init__(self) -> None:
        self.genes_txn = lmdb.open(path.join(directory, 'lmdb/genes')).begin()
        self.chemicals_txn = lmdb.open(path.join(directory, 'lmdb/chemicals')).begin()
        self.compounds_txn = lmdb.open(path.join(directory, 'lmdb/compounds')).begin()
        self.proteins_txn = lmdb.open(path.join(directory, 'lmdb/proteins')).begin()
        self.species_txn = lmdb.open(path.join(directory, 'lmdb/species')).begin()
        self.diseases_txn = lmdb.open(path.join(directory, 'lmdb/diseases')).begin()

    def new_lmdb(self):
        # TODO: JIRA LL-315 from LL-256
        raise NotImplementedError
