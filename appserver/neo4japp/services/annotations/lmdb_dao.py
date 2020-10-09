import lmdb
import json

from os import path
from typing import List

from neo4japp.exceptions import AnnotationError
from neo4japp.services.annotations.constants import (
    ANATOMY_MESH_LMDB,
    CHEMICALS_CHEBI_LMDB,
    COMPOUNDS_BIOCYC_LMDB,
    DISEASES_MESH_LMDB,
    FOODS_MESH_LMDB,
    GENES_NCBI_LMDB,
    PHENOTYPES_MESH_LMDB,
    PROTEINS_UNIPROT_LMDB,
    CHEMICALS_PUBCHEM_LMDB,
    SPECIES_NCBI_LMDB,
)


# reference to this directory
directory = path.realpath(path.dirname(__file__))


class LMDBDao:
    def __init__(
        self,
        anatomy_lmdb_path: str = 'lmdb/anatomy',
        chemicals_lmdb_path: str = 'lmdb/chemicals',
        compounds_lmdb_path: str = 'lmdb/compounds',
        diseases_lmdb_path: str = 'lmdb/diseases',
        foods_lmdb_path: str = 'lmdb/foods',
        genes_lmdb_path: str = 'lmdb/genes',
        phenotypes_lmdb_path: str = 'lmdb/phenotypes',
        proteins_lmdb_path: str = 'lmdb/proteins',
        species_lmdb_path: str = 'lmdb/species',
    ) -> None:
        if all([
            anatomy_lmdb_path,
            chemicals_lmdb_path,
            compounds_lmdb_path,
            diseases_lmdb_path,
            foods_lmdb_path,
            genes_lmdb_path,
            phenotypes_lmdb_path,
            proteins_lmdb_path,
            species_lmdb_path,
        ]):
            self.anatomy_env = lmdb.open(
                path=path.join(directory, anatomy_lmdb_path),
                readonly=True,
                max_dbs=2,
            )
            self.chemicals_env = lmdb.open(
                path=path.join(directory, chemicals_lmdb_path),
                readonly=True,
                max_dbs=2,
            )
            self.compounds_env = lmdb.open(
                path=path.join(directory, compounds_lmdb_path),
                readonly=True,
                max_dbs=2,
            )
            self.diseases_env = lmdb.open(
                path=path.join(directory, diseases_lmdb_path),
                readonly=True,
                max_dbs=2,
            )
            self.foods_env = lmdb.open(
                path=path.join(directory, foods_lmdb_path),
                readonly=True,
                max_dbs=2,
            )
            self.genes_env = lmdb.open(
                path=path.join(directory, genes_lmdb_path),
                readonly=True,
                max_dbs=2,
            )
            self.phenotypes_env = lmdb.open(
                path=path.join(directory, phenotypes_lmdb_path),
                readonly=True,
                max_dbs=2,
            )
            self.proteins_env = lmdb.open(
                path=path.join(directory, proteins_lmdb_path),
                readonly=True,
                max_dbs=2,
            )
            self.species_env = lmdb.open(
                path=path.join(directory, species_lmdb_path),
                readonly=True,
                max_dbs=2,
            )

            """
            !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            IMPORTANT NOTE: As of lmdb 0.98
            !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            In order for `dupsort` to work, need to provide a database name to
            `open_db()`, e.g open_db('db2', dupsort=True).

            If no database name is passed in, it will open the default database,
            and the transaction and cursor will point to the wrong address in
            memory and retrieve whatever is there.
            """
            anatomy_db = self.anatomy_env.open_db(ANATOMY_MESH_LMDB.encode('utf-8'), dupsort=True)  # noqa
            chemicals_db = self.chemicals_env.open_db(CHEMICALS_CHEBI_LMDB.encode('utf-8'), dupsort=True)  # noqa
            compounds_db = self.compounds_env.open_db(COMPOUNDS_BIOCYC_LMDB.encode('utf-8'), dupsort=True)  # noqa
            diseases_db = self.diseases_env.open_db(DISEASES_MESH_LMDB.encode('utf-8'), dupsort=True)  # noqa
            foods_db = self.foods_env.open_db(FOODS_MESH_LMDB.encode('utf-8'), dupsort=True)
            genes_db = self.genes_env.open_db(GENES_NCBI_LMDB.encode('utf-8'), dupsort=True)
            phenotypes_db = self.phenotypes_env.open_db(PHENOTYPES_MESH_LMDB.encode('utf-8'), dupsort=True)  # noqa
            proteins_db = self.proteins_env.open_db(PROTEINS_UNIPROT_LMDB.encode('utf-8'), dupsort=True)  # noqa
            species_db = self.species_env.open_db(SPECIES_NCBI_LMDB.encode('utf-8'), dupsort=True)

            # https://lmdb.readthedocs.io/en/release/#transaction-management
            # TODO: JIRA LL-330 env should be closed at end of app context
            self.anatomy_txn = self.anatomy_env.begin(db=anatomy_db)
            self.chemicals_txn = self.chemicals_env.begin(db=chemicals_db)
            self.compounds_txn = self.compounds_env.begin(db=compounds_db)
            self.diseases_txn = self.diseases_env.begin(db=diseases_db)
            self.foods_txn = self.foods_env.begin(db=foods_db)
            self.genes_txn = self.genes_env.begin(db=genes_db)
            self.phenotypes_txn = self.phenotypes_env.begin(db=phenotypes_db)
            self.proteins_txn = self.proteins_env.begin(db=proteins_db)
            self.species_txn = self.species_env.begin(db=species_db)

    def close_envs(self, envs=[]):
        if not envs:
            envs = [
                self.anatomy_env,
                self.chemicals_env,
                self.compounds_env,
                self.diseases_env,
                self.foods_env,
                self.genes_env,
                self.phenotypes_env,
                self.proteins_env,
                self.species_env
            ]
        self.close_transactions()
        for env in envs:
            env.close()

    def close_transactions(self, txns=[]):
        # temp solution for now
        # abort() because readonly and shouldn't have
        # any data to commit
        if not txns:
            txns = [
                self.anatomy_txn,
                self.chemicals_txn,
                self.compounds_txn,
                self.diseases_txn,
                self.foods_txn,
                self.genes_txn,
                self.phenotypes_txn,
                self.proteins_txn,
                self.species_txn
            ]
        for txn in txns:
            txn.abort()

    def get_lmdb_values(self, txn, key, token_type) -> List[dict]:
        """Return all values for an lmdb key."""
        cursor = txn.cursor()
        cursor.set_key(key.encode('utf-8'))
        try:
            values = [json.loads(v) for v in cursor.iternext_dup()]
        except Exception:
            raise AnnotationError(f'Failed token lookup for type "{token_type}".')
        cursor.close()
        return values

    def new_lmdb(self):
        # TODO: JIRA LL-315 from LL-256
        raise NotImplementedError
