import lmdb
import json

from os import path

from neo4japp.exceptions import AnnotationError
from neo4japp.services.annotations.constants import (
    CHEMICAL_LMDB,
    COMPOUND_LMDB,
    DISEASE_LMDB,
    GENE_LMDB,
    PHENOTYPE_LMDB,
    PROTEIN_LMDB,
    PUBCHEM_LMDB,
    SPECIES_LMDB,
)


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
            self.diseases_env = lmdb.open(
                path=path.join(directory, diseases_lmdb_path),
                readonly=True,
                max_dbs=2,
            )
            self.phenotypes_env = lmdb.open(
                path=path.join(directory, phenotypes_lmdb_path),
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
            genes_db = self.genes_env.open_db(GENE_LMDB.encode('utf-8'), dupsort=True)
            chemicals_db = self.chemicals_env.open_db(CHEMICAL_LMDB.encode('utf-8'), dupsort=True)
            compounds_db = self.compounds_env.open_db(COMPOUND_LMDB.encode('utf-8'), dupsort=True)
            proteins_db = self.proteins_env.open_db(PROTEIN_LMDB.encode('utf-8'), dupsort=True)
            species_db = self.species_env.open_db(SPECIES_LMDB.encode('utf-8'), dupsort=True)
            diseases_db = self.diseases_env.open_db(DISEASE_LMDB.encode('utf-8'), dupsort=True)
            phenotypes_db = self.phenotypes_env.open_db(PHENOTYPE_LMDB.encode('utf-8'), dupsort=True)

            # https://lmdb.readthedocs.io/en/release/#transaction-management
            # TODO: JIRA LL-330 env should be closed at end of app context
            self.genes_txn = self.genes_env.begin(db=genes_db)
            self.chemicals_txn = self.chemicals_env.begin(db=chemicals_db)
            self.compounds_txn = self.compounds_env.begin(db=compounds_db)
            self.proteins_txn = self.proteins_env.begin(db=proteins_db)
            self.species_txn = self.species_env.begin(db=species_db)
            self.diseases_txn = self.diseases_env.begin(db=diseases_db)
            self.phenotypes_txn = self.phenotypes_env.begin(db=phenotypes_db)

    def close_envs(self, envs=[]):
        if not envs:
            envs = [
                self.genes_env,
                self.chemicals_env,
                self.compounds_env,
                self.proteins_env,
                self.species_env,
                self.diseases_env,
                self.phenotypes_env,
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
                self.genes_txn,
                self.chemicals_txn,
                self.compounds_txn,
                self.proteins_txn,
                self.species_txn,
                self.diseases_txn,
                self.phenotypes_txn,
            ]
        for txn in txns:
            txn.abort()

    def get_lmdb_values(self, txn, key, token_type):
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
