import lmdb
import json
import pytest

from os import path, remove, walk

from neo4japp.higher_order_services import HybridNeo4jPostgresService
from neo4japp.services.annotations import prepare_databases
from neo4japp.services.annotations.util import normalize_str


# reference to this directory
directory = path.realpath(path.dirname(__file__))


def create_chemical_lmdb():
    map_size = 1099511627776
    db = lmdb.open(path.join(directory, 'lmdb/chemical'), map_size=map_size)
    with db.begin(write=True) as transaction:
        # TODO: create chemical test lmdb
        transaction.put(
            normalize_str('null').encode('utf-8'),
            json.dumps({}).encode('utf-8'))


def create_compound_lmdb():
    map_size = 1099511627776
    db = lmdb.open(path.join(directory, 'lmdb/compound'), map_size=map_size)
    with db.begin(write=True) as transaction:
        # TODO: create compound test lmdb
        transaction.put(
            normalize_str('null').encode('utf-8'),
            json.dumps({}).encode('utf-8'))


def create_disease_lmdb():
    map_size = 1099511627776
    db = lmdb.open(path.join(directory, 'lmdb/disease'), map_size=map_size)
    with db.begin(write=True) as transaction:
        # TODO: create disease test lmdb
        transaction.put(
            normalize_str('null').encode('utf-8'),
            json.dumps({}).encode('utf-8'))


def create_gene_lmdb():
    map_size = 1099511627776
    db = lmdb.open(path.join(directory, 'lmdb/gene'), map_size=map_size)
    with db.begin(write=True) as transaction:
        gene_name = 'hyp27'
        gene = {
            'gene_id': '2846957',
            'id_type': 'NCBI',
            'name': gene_name,
            'common_name': {'2846957': normalize_str(gene_name)},
        }

        transaction.put(
            normalize_str(gene_name).encode('utf-8'),
            json.dumps(gene).encode('utf-8'))


def create_phenotype_lmdb():
    map_size = 1099511627776
    db = lmdb.open(path.join(directory, 'lmdb/phenotype'), map_size=map_size)
    with db.begin(write=True) as transaction:
        # TODO: create phenotype test lmdb
        transaction.put(
            normalize_str('null').encode('utf-8'),
            json.dumps({}).encode('utf-8'))


def create_protein_lmdb():
    map_size = 1099511627776
    db = lmdb.open(path.join(directory, 'lmdb/protein'), map_size=map_size)
    with db.begin(write=True) as transaction:
        protein_id = 'Y1954_CLOPE'
        protein_name = 'Hyp27'
        protein = {
            # changed protein_id to protein_name for now (JIRA LL-671)
            # will eventually change back to protein_id
            'protein_id': protein_name,
            'id_type': 'UNIPROT',
            'name': protein_name,
            'common_name': {
                protein_id: normalize_str(protein_name),
            },
        }

        transaction.put(
            normalize_str(normalize_str(protein_name)).encode('utf-8'),
            json.dumps(protein).encode('utf-8'))


def create_species_lmdb():
    map_size = 1099511627776
    db = lmdb.open(path.join(directory, 'lmdb/species'), map_size=map_size)
    with db.begin(write=True) as transaction:
        # add human species
        species_id = '9606'
        species_category = 'Eukaryota'
        species_name = 'human'

        species = {
            'tax_id': species_id,
            'id_type': 'NCBI',
            'category': species_category if species_category else 'Uncategorized',
            'name': species_name,
            'common_name': {species_id: normalize_str(species_name)},
        }

        transaction.put(
            normalize_str(species_name).encode('utf-8'),
            json.dumps(species).encode('utf-8'))

        # add Moniliophthora roreri species
        species_id = '221103'
        species_category = 'Eukaryota'
        species_name = 'Moniliophthora roreri'

        species = {
            'tax_id': species_id,
            'id_type': 'NCBI',
            'category': species_category if species_category else 'Uncategorized',
            'name': species_name,
            'common_name': {species_id: normalize_str(species_name)},
        }

        transaction.put(
            normalize_str(species_name).encode('utf-8'),
            json.dumps(species).encode('utf-8'))


@pytest.fixture(scope='function')
def lmdb_setup(app, request):
    create_chemical_lmdb()
    create_compound_lmdb()
    create_disease_lmdb()
    create_gene_lmdb()
    create_phenotype_lmdb()
    create_protein_lmdb()
    create_species_lmdb()

    def teardown():
        for parent, subfolders, filenames in walk(path.join(directory, 'lmdb/')):
            for fn in filenames:
                if fn.lower().endswith('.mdb'):
                    remove(path.join(parent, fn))

    request.addfinalizer(teardown)


# doc on how to monkeypatch: https://docs.pytest.org/en/latest/monkeypatch.html
@pytest.fixture(scope='function')
def mock_get_gene_to_organism_match_result(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'hyp27': {'221103': '10446085'}}

    monkeypatch.setattr(
        HybridNeo4jPostgresService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def annotations_setup(app):
    pass

    # below is not working, always says files are not there
    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/genes/data.mdb')):
    #     prepare_databases.prepare_lmdb_genes_database()

    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/chemicals/data.mdb')):
    #     prepare_databases.prepare_lmdb_chemicals_database()

    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/compounds/data.mdb')):
    #     prepare_databases.prepare_lmdb_compounds_database()

    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/proteins/data.mdb')):
    #     prepare_databases.prepare_lmdb_proteins_database()

    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/species/data.mdb')):
    #     prepare_databases.prepare_lmdb_species_database()

    # if not path.exists(
    #     path.join(
    #         directory,
    #         '../../neo4japp/services/annotations/lmdb/diseases/data.mdb')):
    #     prepare_databases.prepare_lmdb_diseases_database()
