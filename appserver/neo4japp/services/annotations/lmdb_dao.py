import lmdb

from os import path, remove, walk


# reference to this directory
directory = path.realpath(path.dirname(__file__))


class LMDBDao:
    def __init__(self) -> None:
        self.genes_env = lmdb.open(
            path=path.join(directory, 'lmdb/genes'),
            readonly=True,
        )
        self.chemicals_env = lmdb.open(
            path=path.join(directory, 'lmdb/chemicals'),
            readonly=True,
        )
        self.compounds_env = lmdb.open(
            path=path.join(directory, 'lmdb/compounds'),
            readonly=True,
        )
        self.proteins_env = lmdb.open(
            path=path.join(directory, 'lmdb/proteins'),
            readonly=True,
        )
        self.species_env = lmdb.open(
            path=path.join(directory, 'lmdb/species'),
            readonly=True,
        )
        self.diseases_env = lmdb.open(
            path=path.join(directory, 'lmdb/diseases'),
            readonly=True,
        )

        # https://lmdb.readthedocs.io/en/release/#transaction-management
        # env should be closed at end of app context
        self.genes_txn = self.genes_env.begin()
        self.chemicals_txn = self.chemicals_env.begin()
        self.compounds_txn = self.compounds_env.begin()
        self.proteins_txn = self.proteins_env.begin()
        self.species_txn = self.species_env.begin()
        self.diseases_txn = self.diseases_env.begin()

    def new_lmdb(self):
        # TODO: JIRA LL-315 from LL-256
        raise NotImplementedError
