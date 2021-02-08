import lmdb
import os

from neo4japp.util import normalize_str
from neo4japp.services.annotations.constants import (
    ANATOMY_MESH_LMDB,
    CHEMICALS_CHEBI_LMDB,
    COMPOUNDS_BIOCYC_LMDB,
    DISEASES_MESH_LMDB,
    FOODS_MESH_LMDB,
    GENES_NCBI_LMDB,
    PHENOMENAS_MESH_LMDB,
    PHENOTYPES_CUSTOM_LMDB,
    PROTEINS_UNIPROT_LMDB,
    SPECIES_NCBI_LMDB,
)


directory = os.environ.get('LMDB_HOME_FOLDER')


def main():
    anatomy_env = lmdb.open(
        path=os.path.join(lmdb_home, 'lmdb/anatomy'),
        readonly=True,
        max_dbs=2,
    )
    chemicals_env = lmdb.open(
        path=os.path.join(lmdb_home, 'lmdb/chemicals'),
        readonly=True,
        max_dbs=2,
    )
    compounds_env = lmdb.open(
        path=os.path.join(lmdb_home, 'lmdb/compounds'),
        readonly=True,
        max_dbs=2,
    )
    diseases_env = lmdb.open(
        path=os.path.join(lmdb_home, 'lmdb/diseases'),
        readonly=True,
        max_dbs=2,
    )
    foods_env = lmdb.open(
        path=os.path.join(lmdb_home, 'lmdb/foods'),
        readonly=True,
        max_dbs=2,
    )
    genes_env = lmdb.open(
        path=os.path.join(lmdb_home, 'lmdb/genes'),
        readonly=True,
        max_dbs=2,
    )
    phenomenas_env = lmdb.open(
        path=os.path.join(lmdb_home, 'lmdb/phenomenas'),
        readonly=True,
        max_dbs=2,
    )
    phenotypes_env = lmdb.open(
        path=os.path.join(lmdb_home, 'lmdb/phenotypes'),
        readonly=True,
        max_dbs=2,
    )
    proteins_env = lmdb.open(
        path=os.path.join(lmdb_home, 'lmdb/proteins'),
        readonly=True,
        max_dbs=2,
    )
    species_env = lmdb.open(
        path=os.path.join(lmdb_home, 'lmdb/species'),
        readonly=True,
        max_dbs=2,
    )

    anatomy_db = anatomy_env.open_db(ANATOMY_MESH_LMDB.encode('utf-8'), dupsort=True)  # noqa
    chemicals_db = chemicals_env.open_db(CHEMICALS_CHEBI_LMDB.encode('utf-8'), dupsort=True)  # noqa
    compounds_db = compounds_env.open_db(COMPOUNDS_BIOCYC_LMDB.encode('utf-8'), dupsort=True)  # noqa
    diseases_db = diseases_env.open_db(DISEASES_MESH_LMDB.encode('utf-8'), dupsort=True)  # noqa
    foods_db = foods_env.open_db(FOODS_MESH_LMDB.encode('utf-8'), dupsort=True)
    genes_db = genes_env.open_db(GENES_NCBI_LMDB.encode('utf-8'), dupsort=True)
    phenomenas_db = phenomenas_env.open_db(PHENOMENAS_MESH_LMDB.encode('utf-8'), dupsort=True)  # noqa
    phenotypes_db = phenotypes_env.open_db(PHENOTYPES_CUSTOM_LMDB.encode('utf-8'), dupsort=True)  # noqa
    proteins_db = proteins_env.open_db(PROTEINS_UNIPROT_LMDB.encode('utf-8'), dupsort=True)  # noqa
    species_db = species_env.open_db(SPECIES_NCBI_LMDB.encode('utf-8'), dupsort=True)

    # https://lmdb.readthedocs.io/en/release/#transaction-management
    # TODO: JIRA LL-330 env should be closed at end of app context
    anatomy_txn = anatomy_env.begin(db=anatomy_db)
    chemicals_txn = chemicals_env.begin(db=chemicals_db)
    compounds_txn = compounds_env.begin(db=compounds_db)
    diseases_txn = diseases_env.begin(db=diseases_db)
    foods_txn = foods_env.begin(db=foods_db)
    genes_txn = genes_env.begin(db=genes_db)
    phenomenas_txn = phenomenas_env.begin(db=phenomenas_db)
    phenotypes_txn = phenotypes_env.begin(db=phenotypes_db)
    proteins_txn = proteins_env.begin(db=proteins_db)
    species_txn = species_env.begin(db=species_db)

    f = os.path.join(directory, 'text1.txt')

    with open(f, 'r') as text_file:
        for line in text_file:
            for txn in [
                anatomy_txn,
                chemicals_txn,
                compounds_txn,
                diseases_txn,
                foods_txn,
                genes_txn,
                phenomenas_txn,
                phenotypes_txn,
                proteins_txn,
                species_txn
            ]:
                txn.get(normalize_str(line).encode('utf-8'))


if __name__ == '__main__':
    main()
