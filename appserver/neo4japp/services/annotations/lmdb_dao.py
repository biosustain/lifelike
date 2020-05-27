import lmdb

from os import path, remove, walk


# reference to this directory
directory = path.realpath(path.dirname(__file__))


class LMDBDao:
    def __init__(
        self,
        genes_lmdb_path: str = 'lmdb/genes',
        chemicals_lmdb_path: str = 'lmdb/chemicals',
        compounds_lmdb_path: str = 'lmdb/compounds',
        proteins_lmdb_path: str = 'lmdb/proteins',
        species_lmdb_path: str = 'lmdb/species',
        diseases_lmdb_path: str = 'lmdb/diseases',
        phenotypes_lmdb_path: str = 'lmdb/phenotypes',
    ) -> None:
        if all([
            genes_lmdb_path,
            chemicals_lmdb_path,
            compounds_lmdb_path,
            proteins_lmdb_path,
            species_lmdb_path,
            diseases_lmdb_path,
            phenotypes_lmdb_path,
        ]):
            self.genes_env = lmdb.open(
                path=path.join(directory, genes_lmdb_path),
                readonly=True,
            )
            self.chemicals_env = lmdb.open(
                path=path.join(directory, chemicals_lmdb_path),
                readonly=True,
            )
            self.compounds_env = lmdb.open(
                path=path.join(directory, compounds_lmdb_path),
                readonly=True,
            )
            self.proteins_env = lmdb.open(
                path=path.join(directory, proteins_lmdb_path),
                readonly=True,
            )
            self.species_env = lmdb.open(
                path=path.join(directory, species_lmdb_path),
                readonly=True,
            )
            self.diseases_env = lmdb.open(
                path=path.join(directory, diseases_lmdb_path),
                readonly=True,
            )
            self.phenotypes_env = lmdb.open(
                path=path.join(directory, phenotypes_lmdb_path),
                readonly=True,
            )

            # https://lmdb.readthedocs.io/en/release/#transaction-management
            # TODO: JIRA LL-330 env should be closed at end of app context
            self.genes_txn = self.genes_env.begin()
            self.chemicals_txn = self.chemicals_env.begin()
            self.compounds_txn = self.compounds_env.begin()
            self.proteins_txn = self.proteins_env.begin()
            self.species_txn = self.species_env.begin()
            self.diseases_txn = self.diseases_env.begin()
            self.phenotypes_txn = self.phenotypes_env.begin()

    def new_lmdb(self):
        # TODO: JIRA LL-315 from LL-256
        raise NotImplementedError
