import lmdb
import json
import pytest

from os import path, remove, walk

from neo4japp.database import DBConnection, GraphConnection
from neo4japp.models import FileContent, GlobalList
from neo4japp.services.annotations import (
    AnnotationService,
    AnnotationDBService,
    AnnotationGraphService,
    EntityRecognitionService,
    LMDBService,
    ManualAnnotationService
)
from neo4japp.services.annotations.constants import (
    DatabaseType,
    EntityType,
    ManualAnnotationType,
    OrganismCategory,
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
from neo4japp.util import normalize_str


# reference to this directory
directory = path.realpath(path.dirname(__file__))


def teardown():
    for parent, subfolders, filenames in walk(path.join(directory, 'lmdb/')):
        for fn in filenames:
            if fn.lower().endswith('.mdb'):
                remove(path.join(parent, fn))


@pytest.fixture(scope='function')
def graph_service(graph):
    class MockGraphConnection(GraphConnection):
        def __init__(self):
            super().__init__()
            self.graph = graph

    class MockAnnotationGraphService(MockGraphConnection, AnnotationGraphService):
        def __init__(self):
            super().__init__()

    return MockAnnotationGraphService()


@pytest.fixture(scope='function')
def db_service(session):
    class MockDBConnection(DBConnection):
        def __init__(self):
            super().__init__()
            self.session = session

    class MockAnnotationDBService(MockDBConnection, AnnotationDBService):
        def __init__(self):
            super().__init__()

    return MockAnnotationDBService()


@pytest.fixture(scope='function')
def get_annotation_service(db_service, graph_service, lmdb_service, request):
    request.addfinalizer(teardown)

    return AnnotationService(db=db_service, graph=graph_service)


@pytest.fixture(scope='function')
def get_manual_annotation_service(graph_service, lmdb_service, request):
    request.addfinalizer(teardown)

    return ManualAnnotationService(graph=graph_service)


@pytest.fixture(scope='function')
def get_entity_service(db_service, graph_service, lmdb_service, request):
    request.addfinalizer(teardown)

    return EntityRecognitionService(
        db=db_service,
        graph=graph_service,
        lmdb=lmdb_service
    )


@pytest.fixture(scope='function')
def lmdb_service():
    configs = [
        (ANATOMY_MESH_LMDB, 'anatomy'),
        (CHEMICALS_CHEBI_LMDB, 'chemicals'),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds'),
        (FOODS_MESH_LMDB, 'foods'),
        (GENES_NCBI_LMDB, 'genes'),
        (DISEASES_MESH_LMDB, 'diseases'),
        (PROTEINS_UNIPROT_LMDB, 'proteins'),
        (PHENOMENAS_MESH_LMDB, 'phenomenas'),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes'),
        (SPECIES_NCBI_LMDB, 'species'),
    ]

    for db_name, entity in configs:
        create_empty_lmdb(f'lmdb/{entity}', db_name)

    class MockLMDBService(LMDBService):
        def __init__(self, dirpath, **kwargs):
            super().__init__(dirpath, **kwargs)

    return MockLMDBService(
        f'{directory}/lmdb/',
        **{db_name: path for db_name, path in configs})


# Start LMDB Data Helpers
def lmdb_anatomy_factory(
    anatomy_id: str,
    id_type: str,
    name: str,
    synonym: str,
):
    return {
        'anatomy_id': anatomy_id,
        'id_type': id_type,
        'name': name,
        'synonym': synonym,
    }


def lmdb_chemical_factory(
    chemical_id: str,
    id_type: str,
    name: str,
    synonym: str,
):
    return {
        'chemical_id': chemical_id,
        'id_type': id_type,
        'name': name,
        'synonym': synonym,
    }


def lmdb_compound_factory(
    compound_id: str,
    id_type: str,
    name: str,
    synonym: str,
):
    return {
        'compound_id': compound_id,
        'id_type': id_type,
        'name': name,
        'synonym': synonym,
    }


def lmdb_disease_factory(
    disease_id: str,
    id_type: str,
    name: str,
    synonym: str,
):
    return {
        'disease_id': disease_id,
        'id_type': id_type,
        'name': name,
        'synonym': synonym,
    }


def lmdb_food_factory(
    food_id: str,
    id_type: str,
    name: str,
    synonym: str,
):
    return {
        'food_id': food_id,
        'id_type': id_type,
        'name': name,
        'synonym': synonym,
    }


def lmdb_gene_factory(
    gene_id: str,
    id_type: str,
    name: str,
    synonym: str,
    category: str,
):
    return {
        'gene_id': gene_id,
        'id_type': id_type,
        'name': name,
        'synonym': synonym,
        'category': category,
    }


def lmdb_phenomena_factory(
    phenomena_id: str,
    id_type: str,
    name: str,
    synonym: str,
):
    return {
        'phenomena_id': name,
        'id_type': id_type,
        'name': name,
        'synonym': synonym,
    }


def lmdb_phenotype_factory(
    phenotype_id: str,
    id_type: str,
    name: str,
    synonym: str,
):
    return {
        'phenotype_id': name,
        'id_type': id_type,
        'name': name,
        'synonym': synonym,
    }


def lmdb_protein_factory(
    protein_id: str,
    id_type: str,
    name: str,
    synonym: str,
):
    return {
        # changed protein_id to protein_name for now (JIRA LL-671)
        # will eventually change back to protein_id
        'protein_id': name,
        'id_type': id_type,
        'name': name,
        'synonym': synonym,
    }


def lmdb_species_factory(
    tax_id: str,
    id_type: str,
    category: str,
    name: str,
    synonym: str,
):
    return {
        'tax_id': tax_id,
        'id_type': id_type,
        'category': category,
        'name': name,
        'synonym': synonym,
    }
# End LMDB Data Helpers


def create_empty_lmdb(path_to_folder: str, db_name: str):
    map_size = 1099511627776
    env = lmdb.open(path.join(directory, path_to_folder), map_size=map_size, max_dbs=2)
    db = env.open_db(db_name.encode('utf-8'), dupsort=True)
    env.close()


def create_entity_lmdb(path_to_folder: str, db_name: str, entity_objs=[]):
    map_size = 1099511627776
    env = lmdb.open(path.join(directory, path_to_folder), map_size=map_size, max_dbs=2)
    db = env.open_db(db_name.encode('utf-8'), dupsort=True)
    with env.begin(db=db, write=True) as transaction:
        for entity in entity_objs:
            transaction.put(
                normalize_str(entity['synonym']).encode('utf-8'),
                json.dumps(entity).encode('utf-8'))


@pytest.fixture(scope='function')
def default_lmdb_setup(app, request):
    # Create gene data
    bola3 = lmdb_gene_factory(
        gene_id='388962',
        id_type=DatabaseType.NCBI.value,
        name='BOLA3',
        synonym='BOLA3',
        category=OrganismCategory.EUKARYOTA.value,
    )

    ampk = lmdb_gene_factory(
        gene_id='5564',
        id_type=DatabaseType.NCBI.value,
        name='PRKAB1',
        synonym='AMPK',
        category=OrganismCategory.EUKARYOTA.value,
    )

    hyp27_gene = lmdb_gene_factory(
        gene_id='2846957',
        id_type=DatabaseType.NCBI.value,
        name='hyp27',
        synonym='hyp27',
        category=OrganismCategory.EUKARYOTA.value,
    )

    serpina1_gene = lmdb_gene_factory(
        gene_id='5265',
        id_type=DatabaseType.NCBI.value,
        name='SERPINA1',
        synonym='SERPINA1',
        category=OrganismCategory.EUKARYOTA.value,
    )

    serpina1_gene2 = lmdb_gene_factory(
        gene_id='322701',
        id_type=DatabaseType.NCBI.value,
        name='serpina1',
        synonym='serpina1',
        category=OrganismCategory.EUKARYOTA.value,
    )

    # Create phenotype data
    whey_protein = lmdb_phenotype_factory(
        phenotype_id='MESH:D000067816',
        id_type=DatabaseType.CUSTOM.value,
        name='Whey Proteins',
        synonym='Whey Proteins',
    )

    # Create protein data
    hyp27_protein = lmdb_protein_factory(
        protein_id='Y1954_CLOPE',
        id_type=DatabaseType.UNIPROT.value,
        name='Hyp27',
        synonym='Hyp27',
    )

    wasabi = lmdb_protein_factory(
        protein_id='KKX1U_UROMN',
        id_type=DatabaseType.UNIPROT.value,
        name='Wasabi receptor toxin',
        synonym='Wasabi receptor toxin',
    )
    ns2a = lmdb_protein_factory(
        protein_id='NS2A_CVBM',
        id_type=DatabaseType.UNIPROT.value,
        name='ns2a',
        synonym='ns2a',
    )

    NS2A = lmdb_protein_factory(
        protein_id='POLG_ZIKVK',
        id_type=DatabaseType.UNIPROT.value,
        name='NS2A',
        synonym='NS2A',
    )

    serpina1_protein = lmdb_protein_factory(
        protein_id='A1AT_PONAB',
        id_type=DatabaseType.UNIPROT.value,
        name='Serpin A1',
        synonym='Serpin A1',
    )

    # Create species data
    human = lmdb_species_factory(
        tax_id='9606',
        category=OrganismCategory.EUKARYOTA.value,
        id_type=DatabaseType.NCBI.value,
        name='human',
        synonym='human',
    )

    homosapiens = lmdb_species_factory(
        tax_id='9606',
        category=OrganismCategory.EUKARYOTA.value,
        id_type=DatabaseType.NCBI.value,
        name='Homo Sapiens',
        synonym='Homo Sapiens',
    )

    rat = lmdb_species_factory(
        tax_id='10114',
        category=OrganismCategory.EUKARYOTA.value,
        id_type=DatabaseType.NCBI.value,
        name='rat',
        synonym='rat',
    )

    moniliophthora_roreri = lmdb_species_factory(
        tax_id='221103',
        category=OrganismCategory.EUKARYOTA.value,
        id_type=DatabaseType.NCBI.value,
        name='Moniliophthora roreri',
        synonym='Moniliophthora roreri',
    )

    # Create chemical data
    arginine = lmdb_chemical_factory(
        chemical_id='CHEBI:29952',
        id_type=DatabaseType.CHEBI.value,
        name='L-arginine residue',
        synonym='Arg',
    )

    lead = lmdb_chemical_factory(
        chemical_id='CHEBI:Lead',
        id_type=DatabaseType.CHEBI.value,
        name='Lead',
        synonym='Lead',
    )

    hypofluorite = lmdb_chemical_factory(
        chemical_id='CHEBI:30244',
        id_type=DatabaseType.CHEBI.value,
        name='hypofluorite',
        synonym='FO(-)',
    )

    histidine = lmdb_chemical_factory(
        chemical_id='CHEBI:29979',
        id_type=DatabaseType.CHEBI.value,
        name='L-histidine residue',
        synonym='H',
    )

    adenosine = lmdb_chemical_factory(
        chemical_id='CHEBI:16335',
        id_type=DatabaseType.CHEBI.value,
        name='adenosine',
        synonym='adenosine',
    )

    adenosine2 = lmdb_compound_factory(
        compound_id='ADENOSINE',
        id_type=DatabaseType.BIOCYC.value,
        name='adenosine',
        synonym='adenosine',
    )

    leadcp = lmdb_compound_factory(
        compound_id='LEAD',
        id_type=DatabaseType.BIOCYC.value,
        name='Lead',
        synonym='Lead',
    )

    guanosine = lmdb_compound_factory(
        compound_id='GUANOSINE',
        id_type=DatabaseType.BIOCYC.value,
        name='guanosine',
        synonym='guanosine',
    )

    # Create disease data
    cold_sore = lmdb_disease_factory(
        disease_id='MESH:D006560',
        id_type=DatabaseType.MESH.value,
        name='cold sore',
        synonym='cold sore',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', [adenosine, arginine, hypofluorite, histidine, lead]),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', [adenosine2, guanosine, leadcp]),
        (DISEASES_MESH_LMDB, 'diseases', [cold_sore]),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [ampk, bola3, hyp27_gene, serpina1_gene, serpina1_gene2]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', [whey_protein]),
        (PROTEINS_UNIPROT_LMDB, 'proteins', [hyp27_protein, serpina1_protein, wasabi, ns2a, NS2A]),
        (SPECIES_NCBI_LMDB, 'species', [homosapiens, human, moniliophthora_roreri, rat]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def abbreviation_lmdb_setup(app, request):
    pathway = lmdb_phenotype_factory(
        phenotype_id='MESH:D010427',
        id_type=DatabaseType.MESH.value,
        name='Pentose Phosphate Pathway',
        synonym='Pentose Phosphate Pathway',
    )

    hypertension = lmdb_disease_factory(
        disease_id='MESH:D000081029',
        id_type=DatabaseType.MESH.value,
        name='Pulmonary Arterial Hypertension',
        synonym='Pulmonary Arterial Hypertension',
    )

    ppp = lmdb_gene_factory(
        gene_id='101099627',
        id_type=DatabaseType.NCBI.value,
        name='PPP',
        synonym='PPP',
        category=OrganismCategory.EUKARYOTA.value,
    )

    pah = lmdb_gene_factory(
        gene_id='245623',
        id_type=DatabaseType.NCBI.value,
        name='PAH',
        synonym='PAH',
        category=OrganismCategory.EUKARYOTA.value,
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', [hypertension]),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [ppp, pah]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', [pathway]),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', []),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def global_inclusion_normalized_already_in_lmdb_setup(app, request):
    il8_gene = lmdb_gene_factory(
        gene_id='gene-IL8',
        id_type=DatabaseType.NCBI.value,
        name='CXCL8',
        synonym='IL8',
        category=OrganismCategory.EUKARYOTA.value,
    )

    il8_protein = lmdb_protein_factory(
        protein_id='protein-IL8',
        id_type=DatabaseType.UNIPROT.value,
        name='CXCL8',
        synonym='IL8',
    )

    homosapiens = lmdb_species_factory(
        tax_id='9606',
        category=OrganismCategory.EUKARYOTA.value,
        id_type=DatabaseType.NCBI.value,
        name='Homo Sapiens',
        synonym='Human',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [il8_gene]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', [il8_protein]),
        (SPECIES_NCBI_LMDB, 'species', [homosapiens]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def food_lmdb_setup(app, request):
    sweetener = lmdb_food_factory(
        food_id='MESH:D013549',
        id_type=DatabaseType.MESH.value,
        name='Sweetening Agents',
        synonym='Artificial Sweeteners',
    )

    bacon = lmdb_food_factory(
        food_id='MESH:D000080305',
        id_type=DatabaseType.MESH.value,
        name='Pork Meat',
        synonym='Bacon',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', [bacon, sweetener]),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', []),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def anatomy_lmdb_setup(app, request):
    filamin = lmdb_anatomy_factory(
        anatomy_id='MESH:D064448',
        id_type=DatabaseType.MESH.value,
        name='Filamins',
        synonym='280 kDa Actin Binding Protein',
    )

    claws = lmdb_anatomy_factory(
        anatomy_id='MESH:D006724',
        id_type=DatabaseType.MESH.value,
        name='Hoof and Claw',
        synonym='Claws',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', [claws, filamin]),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', []),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def bola_human_monkey_gene(app, request):
    # Create gene data
    bola3 = lmdb_gene_factory(
        gene_id='388962',
        id_type=DatabaseType.NCBI.value,
        name='BOLA3',
        synonym='BOLA3',
        category=OrganismCategory.EUKARYOTA.value,
    )

    bola3_monkey = lmdb_gene_factory(
        gene_id='101099627',
        id_type=DatabaseType.NCBI.value,
        name='BOLA3',
        synonym='BOLA3',
        category=OrganismCategory.EUKARYOTA.value,
    )

    # Create species data
    human = lmdb_species_factory(
        tax_id='9606',
        category=OrganismCategory.EUKARYOTA.value,
        id_type=DatabaseType.NCBI.value,
        name='Homo sapiens',
        synonym='Homo sapiens',
    )

    monkey = lmdb_species_factory(
        tax_id='37293',
        category=OrganismCategory.EUKARYOTA.value,
        id_type=DatabaseType.NCBI.value,
        name='Aotus nancymai',
        synonym='Aotus nancymai',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [bola3, bola3_monkey]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [human, monkey]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def human_gene_pdf_lmdb_setup(app, request):
    # Create gene data
    ace2 = lmdb_gene_factory(
        gene_id='59272',
        id_type=DatabaseType.NCBI.value,
        name='ACE2',
        synonym='ACE2',
        category=OrganismCategory.EUKARYOTA.value,
    )

    # Create disease data
    covid_19 = lmdb_disease_factory(
        disease_id='MESH:C000657245',
        id_type=DatabaseType.MESH.value,
        name='COVID-19',
        synonym='COVID-19',
    )

    # Create species data
    mers_cov = lmdb_species_factory(
        tax_id='1335626',
        category=OrganismCategory.VIRUSES.value,
        id_type=DatabaseType.NCBI.value,
        name='MERS-CoV',
        synonym='MERS-CoV',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', [covid_19]),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [ace2]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [mers_cov]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def gene_organism_escherichia_coli_pdf_lmdb_setup(app, request):
    # Create gene data
    purA = lmdb_gene_factory(
        gene_id='948695',
        id_type=DatabaseType.NCBI.value,
        name='purA',
        synonym='purA',
        category=OrganismCategory.EUKARYOTA.value,
    )

    purB = lmdb_gene_factory(
        gene_id='945695',
        id_type=DatabaseType.NCBI.value,
        name='purB',
        synonym='purB',
        category=OrganismCategory.EUKARYOTA.value,
    )

    purC = lmdb_gene_factory(
        gene_id='946957',
        id_type=DatabaseType.NCBI.value,
        name='purC',
        synonym='purC',
        category=OrganismCategory.EUKARYOTA.value,
    )

    purD = lmdb_gene_factory(
        gene_id='948504',
        id_type=DatabaseType.NCBI.value,
        name='purF',
        synonym='purF',
        category=OrganismCategory.EUKARYOTA.value,
    )

    purF = lmdb_gene_factory(
        gene_id='946794',
        id_type=DatabaseType.NCBI.value,
        name='purD',
        synonym='purD',
        category=OrganismCategory.EUKARYOTA.value,
    )

    # Create species data
    e_coli = lmdb_species_factory(
        tax_id='562',
        category=OrganismCategory.BACTERIA.value,
        id_type=DatabaseType.NCBI.value,
        name='Escherichia coli',
        synonym='Escherichia coli',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [purA, purB, purC, purD, purF]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [e_coli]),
    ]
    for db_names, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_names, data)

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def protein_organism_escherichia_coli_pdf_lmdb_setup(app, request):
    ydhc = lmdb_protein_factory(
        protein_id='YdhC',
        id_type=DatabaseType.UNIPROT.value,
        name='YdhC',
        synonym='YdhC',
    )

    ydhb = lmdb_protein_factory(
        protein_id='YdhB',
        id_type=DatabaseType.UNIPROT.value,
        name='YdhB',
        synonym='YdhB',
    )

    # Create species data
    e_coli = lmdb_species_factory(
        tax_id='562',
        category=OrganismCategory.BACTERIA.value,
        id_type=DatabaseType.NCBI.value,
        name='Escherichia coli',
        synonym='Escherichia coli',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', [ydhb, ydhc]),
        (SPECIES_NCBI_LMDB, 'species', [e_coli]),
    ]
    for db_names, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_names, data)

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def human_rat_gene_lmdb_setup(app, request):
    # Create gene data
    edem3 = lmdb_gene_factory(
        gene_id='289085',
        id_type=DatabaseType.NCBI.value,
        name='Edem3',
        synonym='Edem3',
        category=OrganismCategory.EUKARYOTA.value,
    )

    edem3_caps = lmdb_gene_factory(
        gene_id='80267',
        id_type=DatabaseType.NCBI.value,
        name='EDEM3',
        synonym='EDEM3',
        category=OrganismCategory.EUKARYOTA.value,
    )

    # Create species data
    human = lmdb_species_factory(
        tax_id='9606',
        category=OrganismCategory.EUKARYOTA.value,
        id_type=DatabaseType.NCBI.value,
        name='human',
        synonym='human',
    )

    rat = lmdb_species_factory(
        tax_id='10116',
        category=OrganismCategory.EUKARYOTA.value,
        id_type=DatabaseType.NCBI.value,
        name='rat',
        synonym='rat',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [edem3, edem3_caps]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [human, rat]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def fish_gene_lmdb_setup(app, request):
    # Create gene data
    IL7 = lmdb_gene_factory(
        gene_id='102353780',
        id_type=DatabaseType.NCBI.value,
        name='IL7',
        synonym='IL7',
        category=OrganismCategory.EUKARYOTA.value,
    )

    il7 = lmdb_gene_factory(
        gene_id='100191071',
        id_type=DatabaseType.NCBI.value,
        name='il-7',
        synonym='il-7',
        category=OrganismCategory.EUKARYOTA.value,
    )

    # Create species data
    tetraodon = lmdb_species_factory(
        tax_id='31033',
        category=OrganismCategory.EUKARYOTA.value,
        id_type=DatabaseType.NCBI.value,
        name='Tetraodon rubripes',
        synonym='Tetraodon rubripes',
    )

    coelacanth = lmdb_species_factory(
        tax_id='7897',
        category=OrganismCategory.EUKARYOTA.value,
        id_type=DatabaseType.NCBI.value,
        name='coelacanth',
        synonym='coelacanth',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [IL7, il7]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [coelacanth, tetraodon]),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def vascular_cell_adhesion_lmdb_setup(app, request):
    vascular = lmdb_protein_factory(
        protein_id='Vascular',
        id_type=DatabaseType.UNIPROT.value,
        name='Vascular cell adhesion protein 1',
        synonym='Vascular cell adhesion protein 1',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', []),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', [vascular]),
        (SPECIES_NCBI_LMDB, 'species', []),
    ]
    for db_name, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_name, data)

    request.addfinalizer(teardown)


@pytest.fixture(scope='function')
def gene_organism_matching_use_organism_before_lmdb_setup(app, request):
    ptgs2 = lmdb_gene_factory(
        gene_id='289085',
        id_type=DatabaseType.NCBI.value,
        name='PTGS2',
        synonym='PTGS2',
        category=OrganismCategory.EUKARYOTA.value,
    )

    bdnf = lmdb_gene_factory(
        gene_id='28908534',
        id_type=DatabaseType.NCBI.value,
        name='BDNF',
        synonym='BDNF',
        category=OrganismCategory.EUKARYOTA.value,
    )

    bst2 = lmdb_gene_factory(
        gene_id='2890832455',
        id_type=DatabaseType.NCBI.value,
        name='BST2',
        synonym='BST2',
        category=OrganismCategory.EUKARYOTA.value,
    )

    cat = lmdb_species_factory(
        tax_id='9685',
        category=OrganismCategory.EUKARYOTA.value,
        id_type=DatabaseType.NCBI.value,
        name='Felis Catus',
        synonym='Felis Catus',
    )

    homo = lmdb_species_factory(
        tax_id='9606',
        category=OrganismCategory.EUKARYOTA.value,
        id_type=DatabaseType.NCBI.value,
        name='Homo Sapiens',
        synonym='Homo Sapiens',
    )

    human = lmdb_species_factory(
        tax_id='9606',
        category=OrganismCategory.EUKARYOTA.value,
        id_type=DatabaseType.NCBI.value,
        name='Human',
        synonym='Human',
    )

    entities = [
        (ANATOMY_MESH_LMDB, 'anatomy', []),
        (CHEMICALS_CHEBI_LMDB, 'chemicals', []),
        (COMPOUNDS_BIOCYC_LMDB, 'compounds', []),
        (DISEASES_MESH_LMDB, 'diseases', []),
        (FOODS_MESH_LMDB, 'foods', []),
        (GENES_NCBI_LMDB, 'genes', [ptgs2, bdnf, bst2]),
        (PHENOTYPES_CUSTOM_LMDB, 'phenotypes', []),
        (PROTEINS_UNIPROT_LMDB, 'proteins', []),
        (SPECIES_NCBI_LMDB, 'species', [homo, human, cat]),
    ]
    for db_names, entity, data in entities:
        create_entity_lmdb(f'lmdb/{entity}', db_names, data)

    def teardown():
        for parent, subfolders, filenames in walk(path.join(directory, 'lmdb/')):
            for fn in filenames:
                if fn.lower().endswith('.mdb'):
                    remove(path.join(parent, fn))

    request.addfinalizer(teardown)


################################################################################
# Start monkeypatch mocks here
# doc on how to monkeypatch: https://docs.pytest.org/en/latest/monkeypatch.html
###############################################################################
@pytest.fixture(scope='function')
def mock_empty_gene_to_organism(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {}

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_general_human_genes(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'BOLA3': {'BOLA3': {'9606': '388962'}}}

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_match_result(monkeypatch):
    def get_match_result(*args, **kwargs):
        # match to 'Moniliophthora roreri' in create_species_lmdb()
        return {
            'hyp27': {'hyp27': {'221103': '2846957'}},
            'SERPINA1': {'serpina1': {'9606': '5265'}, 'SERPINA1': {'9606': '5265'}}
        }

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_gene_to_organism_crossmatch_human_fish(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'il-7': {'IL7': {'7897': '102353780'}, 'il-7': {'31033': '99999'}}}

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_match_result_for_human_gene_pdf(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'ACE2': {'ACE2': {'9606': '59272'}}}

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_gene_to_organism_il8_human_gene(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'CXCL8': {'CXCL8': {'9606': '3576'}}}

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_match_result_for_gene_primary_name_pdf(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'AMPK': {'AMPK': {'9606': '5564'}}}

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_gene_to_organism_crossmatch_human_rat(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {'EDEM3': {'EDEM3': {'9606': '80267'}, 'Edem3': {'10116': '289085'}}}

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_match_result_for_escherichia_coli_pdf(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {
            'purA': {'purA': {'562': '948695'}},
            'purB': {'purB': {'562': '945695'}},
            'purC': {'purC': {'562': '946957'}},
            'purD': {'purD': {'562': '948504'}},
            'purF': {'purF': {'562': '946794'}},
        }

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_gene_organism_abbrev_test(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {
            'PPP': {'PPP': {'9606': '80267'}},
            'PAH': {'PAH': {'9606': '289085'}}
        }

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_protein_to_organism_match_result_for_escherichia_coli_pdf(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {
            'YdhC': {'562': 'P37597'},
            'YdhB': {'562': 'P0ACR2'},
        }

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_proteins_to_organisms',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_get_gene_to_organism_match_using_organism_before(monkeypatch):
    def get_match_result(*args, **kwargs):
        return {
            'PTGS2': {'PTGS2': {'9606': '5743', '9685': '100126581'}},
            'BDNF': {'BDNF': {'9606': '627', '9685': '493690'}},
            'BST2': {'BST2': {'9606': '684', '9685': '100652388'}}
        }

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_compound_exclusion():
    return {'guanosine', 'hydrogen'}


@pytest.fixture(scope='function')
def mock_global_chemical_exclusion():
    return {'hypofluorite', 'hydrogen', 'adenosine'}


@pytest.fixture(scope='function')
def mock_disease_exclusion():
    return {'cold sore'}


@pytest.fixture(scope='function')
def mock_gene_exclusion():
    return {'BOLA3', 'rpoS'}


@pytest.fixture(scope='function')
def mock_phenotype_exclusion():
    return {'whey proteins'}


@pytest.fixture(scope='function')
def mock_protein_exclusion():
    return {'Wasabi receptor toxin'}


@pytest.fixture(scope='function')
def mock_species_exclusion():
    return {'human', 'dog', 'fruit fly'}


@pytest.fixture(scope='function')
def mock_get_gene_ace2_for_global_gene_inclusion(monkeypatch):
    def get_exclusions(*args, **kwargs):
        return {'59272': 'ACE2'}

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_genes_from_gene_ids',
        get_exclusions,
    )


@pytest.fixture(scope='function')
def mock_get_gene_IL8_CXCL8_for_global_gene_inclusion(monkeypatch):
    def get_exclusions(*args, **kwargs):
        return {'3576': 'CXCL8'}

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_genes_from_gene_ids',
        get_exclusions,
    )


@pytest.fixture(scope='function')
def mock_get_gene_specified_strain(monkeypatch):
    result = [
        {'BOLA3': {'BOLA3': {'9606': '388962'}}},
        {'BOLA3': {'BOLA3': {'37293': '101099627'}}}
    ]

    def get_match_result(*args, **kwargs):
        # simulate service being called twice
        # TODO: not working as expected...
        return result.pop()

    monkeypatch.setattr(
        AnnotationGraphService,
        'get_gene_to_organism_match_result',
        get_match_result,
    )


@pytest.fixture(scope='function')
def mock_global_chemical_inclusion(session):
    annotation = {
        'meta': {
            'id': 'CHEBI:Fake',
            'type': EntityType.CHEMICAL.value,
            'allText': 'fake-chemical-(12345)',
            'idType': '',
            'idHyperlink': ''
        }
    }

    annotation2 = {
        'meta': {
            'id': 'CHEBI:Fake',
            'type': EntityType.CHEMICAL.value,
            'allText': 'Carbon',
            'idType': 'MESH',
            'idHyperlink': 'http://fake'
        }
    }

    file_content = FileContent(raw_file=b'', checksum_sha256=b'')
    session.add(file_content)
    session.flush()

    for anno in [annotation, annotation2]:
        inclusion = GlobalList(
            annotation=anno,
            type=ManualAnnotationType.INCLUSION.value,
            file_content_id=file_content.id,
            reviewed=True,
            approved=True,
        )

        session.add(inclusion)
        session.flush()


@pytest.fixture(scope='function')
def mock_global_compound_inclusion(session):
    annotation = {
        'meta': {
            'id': 'BIOC:Fake',
            'type': EntityType.COMPOUND.value,
            'allText': 'compound-(12345)',
            'idType': '',
            'idHyperlink': ''
        }
    }

    file_content = FileContent(raw_file=b'', checksum_sha256=b'')
    session.add(file_content)
    session.flush()

    inclusion = GlobalList(
        annotation=annotation,
        type=ManualAnnotationType.INCLUSION.value,
        file_content_id=file_content.id,
        reviewed=True,
        approved=True,
    )

    session.add(inclusion)
    session.flush()


@pytest.fixture(scope='function')
def mock_global_gene_inclusion(session):
    annotation = {
        'meta': {
            'id': '59272',
            'type': EntityType.GENE.value,
            'allText': 'gene-(12345)',
            'idType': '',
            'idHyperlink': ''
        }
    }

    annotation2 = {
        'meta': {
            'id': '3576',
            'type': EntityType.GENE.value,
            'allText': 'IL-8',
            'idType': '',
            'idHyperlink': ''
        }
    }

    file_content = FileContent(raw_file=b'', checksum_sha256=b'')
    session.add(file_content)
    session.flush()

    inclusion = GlobalList(
        annotation=annotation,
        type=ManualAnnotationType.INCLUSION.value,
        file_content_id=file_content.id,
        reviewed=True,
        approved=True,
    )

    session.add(inclusion)
    session.flush()

    inclusion2 = GlobalList(
        annotation=annotation2,
        type=ManualAnnotationType.INCLUSION.value,
        file_content_id=file_content.id,
        reviewed=True,
        approved=True,
    )

    session.add(inclusion2)
    session.flush()


@pytest.fixture(scope='function')
def mock_global_disease_inclusion(session):
    annotation = {
        'meta': {
            'id': 'Ncbi:Fake',
            'type': EntityType.DISEASE.value,
            'allText': 'disease-(12345)',
            'idType': '',
            'idHyperlink': ''
        }
    }

    file_content = FileContent(raw_file=b'', checksum_sha256=b'')
    session.add(file_content)
    session.flush()

    inclusion = GlobalList(
        annotation=annotation,
        type=ManualAnnotationType.INCLUSION.value,
        file_content_id=file_content.id,
        reviewed=True,
        approved=True,
    )

    session.add(inclusion)
    session.flush()


@pytest.fixture(scope='function')
def mock_global_phenomena_inclusion(session):
    annotation = {
        'meta': {
            'id': 'Fake',
            'type': EntityType.PHENOMENA.value,
            'allText': 'fake-phenomena',
            'idType': '',
            'idHyperlink': ''
        }
    }

    file_content = FileContent(raw_file=b'', checksum_sha256=b'')
    session.add(file_content)
    session.flush()

    inclusion = GlobalList(
        annotation=annotation,
        type=ManualAnnotationType.INCLUSION.value,
        file_content_id=file_content.id,
        reviewed=True,
        approved=True,
    )

    session.add(inclusion)
    session.flush()


@pytest.fixture(scope='function')
def mock_global_phenotype_inclusion(session):
    annotation = {
        'meta': {
            'id': 'Fake',
            'type': EntityType.PHENOTYPE.value,
            'allText': 'phenotype-(12345)',
            'idType': '',
            'idHyperlink': ''
        }
    }

    file_content = FileContent(raw_file=b'', checksum_sha256=b'')
    session.add(file_content)
    session.flush()

    inclusion = GlobalList(
        annotation=annotation,
        type=ManualAnnotationType.INCLUSION.value,
        file_content_id=file_content.id,
        reviewed=True,
        approved=True,
    )

    session.add(inclusion)
    session.flush()


@pytest.fixture(scope='function')
def mock_global_protein_inclusion(session):
    annotation = {
        'meta': {
            'id': 'Ncbi:Fake',
            'type': EntityType.PROTEIN.value,
            'allText': 'protein-(12345)',
            'idType': '',
            'idHyperlink': ''
        }
    }

    file_content = FileContent(raw_file=b'', checksum_sha256=b'')
    session.add(file_content)
    session.flush()

    inclusion = GlobalList(
        annotation=annotation,
        type=ManualAnnotationType.INCLUSION.value,
        file_content_id=file_content.id,
        reviewed=True,
        approved=True,
    )

    session.add(inclusion)
    session.flush()


@pytest.fixture(scope='function')
def mock_global_species_inclusion(session):
    annotation = {
        'meta': {
            'id': 'Ncbi:Fake',
            'type': EntityType.SPECIES.value,
            'allText': 'species-(12345)',
            'idType': '',
            'idHyperlink': ''
        }
    }

    file_content = FileContent(raw_file=b'', checksum_sha256=b'')
    session.add(file_content)
    session.flush()

    inclusion = GlobalList(
        annotation=annotation,
        type=ManualAnnotationType.INCLUSION.value,
        file_content_id=file_content.id,
        reviewed=True,
        approved=True,
    )

    session.add(inclusion)
    session.flush()
