"""This file should be executed during first deployment,
or whenever the LMDB databases in this file needs reset, or
fixed.

Any new LMDB env should use LMDBDAO() instead.
"""
import csv
import lmdb
import json

from os import path, remove, walk

from .constants import (
    CHEMICALS_CHEBI_LMDB,
    COMPOUNDS_BIOCYC_LMDB,
    DISEASES_MESH_LMDB,
    GENES_NCBI_LMDB,
    PHENOMENAS_MESH_LMDB,
    PHENOTYPES_CUSTOM_LMDB,
    PROTEINS_UNIPROT_LMDB,
    CHEMICALS_PUBCHEM_LMDB,
    SPECIES_NCBI_LMDB,
    FOODS_MESH_LMDB,
    ANATOMY_MESH_LMDB,
    DatabaseType,
)
from .utils.lmdb import (
    create_ner_type_anatomy,
    create_ner_type_chemical,
    create_ner_type_compound,
    create_ner_type_disease,
    create_ner_type_food,
    create_ner_type_gene,
    create_ner_type_phenomena,
    create_ner_type_phenotype,
    create_ner_type_protein,
    create_ner_type_species,
)
from neo4japp.util import normalize_str


# reference to this directory
directory = path.realpath(path.dirname(__file__))


"""JIRA LL-1015:
Change the structure of LMDB to allow duplicate keys. The reason
is because there can be synonyms that are also common names,
e.g chebi and compounds, and we want to avoid losing the synonyms
of these synonyms that are also common names.

Previously we were collapsing into a collection `common_name`. But
we don't want that, instead row in LMDB should represent a row in the datset.

Additionally, this also fixes the collapsing of genes. A gene can
appear multiple times in a dataset, with each time, it has a different
gene id and references a different taxonomy id. By allowing duplicate
keys, we do not lose these genes.

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
IMPORTANT NOTE: As of lmdb 0.98
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
In order for `dupsort` to work, need to provide a database name to
`open_db()`, e.g open_db('db2', dupsort=True).

If no database name is passed in, it will open the default database,
and the transaction and cursor will point to the wrong address in
memory and retrieve whatever is there.
"""


def prepare_lmdb_genes_database(filename: str):
    with open(path.join(directory, filename), 'r') as f:
        map_size = 1099511627776
        env = lmdb.open(path.join(directory, 'lmdb/genes'), map_size=map_size, max_dbs=2)
        db = env.open_db(GENES_NCBI_LMDB.encode('utf-8'), dupsort=True)

        with env.begin(db=db, write=True) as transaction:
            reader = csv.reader(f, delimiter='\t', quotechar='"')
            # skip headers
            # geneId	geneName	synonym	data_source
            headers = next(reader)
            for line in reader:
                gene_name = line[1]
                synonym = line[2]
                data_source = line[3]

                gene = create_ner_type_gene(
                    name=gene_name, synonym=synonym, data_source=data_source)

                try:
                    transaction.put(
                        normalize_str(synonym).encode('utf-8'),
                        json.dumps(gene).encode('utf-8'),
                    )
                except lmdb.BadValsizeError:
                    # ignore any keys that are too large
                    # LMDB has max key size 512 bytes
                    # can change but larger keys mean performance issues
                    continue


def prepare_lmdb_chemicals_database(filename: str):
    with open(path.join(directory, filename), 'r') as f:
        map_size = 1099511627776
        env = lmdb.open(path.join(directory, 'lmdb/chemicals'), map_size=map_size, max_dbs=2)
        db = env.open_db(CHEMICALS_CHEBI_LMDB.encode('utf-8'), dupsort=True)

        with env.begin(db=db, write=True) as transaction:
            reader = csv.reader(f, delimiter='\t', quotechar='"')
            # skip headers
            # id	name	synonym
            headers = next(reader)
            for line in reader:
                chemical_id = line[0]
                chemical_name = line[1]
                synonym = line[2]

                chemical = create_ner_type_chemical(
                    id_=chemical_id,
                    name=chemical_name,
                    synonym=synonym,
                )

                try:
                    transaction.put(
                        normalize_str(synonym).encode('utf-8'),
                        json.dumps(chemical).encode('utf-8'),
                    )
                except lmdb.BadValsizeError:
                    # ignore any keys that are too large
                    # LMDB has max key size 512 bytes
                    # can change but larger keys mean performance issues
                    continue


def prepare_lmdb_compounds_database(filename: str):
    with open(path.join(directory, filename), 'r') as f:
        map_size = 1099511627776
        env = lmdb.open(path.join(directory, 'lmdb/compounds'), map_size=map_size, max_dbs=2)
        db = env.open_db(COMPOUNDS_BIOCYC_LMDB.encode('utf-8'), dupsort=True)

        with env.begin(db=db, write=True) as transaction:
            reader = csv.reader(f, delimiter=',', quotechar='"')
            # skip headers
            # n.biocyc_id,n.common_name,n.synonyms
            headers = next(reader)
            for line in reader:
                compound_id = line[0]
                compound_name = line[1]
                synonyms = line[2].split('|')

                if compound_name != 'null':
                    compound = create_ner_type_compound(
                        id_=compound_id,
                        name=compound_name,
                        synonym=compound_name,
                    )

                    try:
                        transaction.put(
                            normalize_str(compound_name).encode('utf-8'),
                            json.dumps(compound).encode('utf-8'),
                        )

                        if synonyms:
                            for synonym_term in synonyms:
                                if synonym_term != 'null':
                                    normalized_key = normalize_str(synonym_term)

                                    synonym = create_ner_type_compound(
                                        id_=compound_id,
                                        name=compound_name,
                                        synonym=synonym_term,
                                    )

                                    transaction.put(
                                        normalized_key.encode('utf-8'),
                                        json.dumps(synonym).encode('utf-8'),
                                    )
                    except lmdb.BadValsizeError:
                        # ignore any keys that are too large
                        # LMDB has max key size 512 bytes
                        # can change but larger keys mean performance issues
                        continue


def prepare_lmdb_proteins_database(filename: str):
    with open(path.join(directory, filename), 'r') as f:
        map_size = 1099511627776
        env = lmdb.open(path.join(directory, 'lmdb/proteins'), map_size=map_size, max_dbs=2)
        db = env.open_db(PROTEINS_UNIPROT_LMDB.encode('utf-8'), dupsort=True)

        with env.begin(db=db, write=True) as transaction:
            reader = csv.reader(f, delimiter='\t', quotechar='"')
            # skip headers (only care for first 3)
            # id	name	synonym	...
            headers = next(reader)
            for line in reader:
                # synonyms already have their own line in dataset
                #
                protein_id = line[1]
                protein_name = line[2]
                # changed protein_id to protein_name for now (JIRA LL-671)
                # will eventually change back to protein_id
                protein = create_ner_type_protein(
                    name=protein_name, synonym=protein_name)

                try:
                    transaction.put(
                        normalize_str(protein_name).encode('utf-8'),
                        json.dumps(protein).encode('utf-8'),
                    )
                except lmdb.BadValsizeError:
                    # ignore any keys that are too large
                    # LMDB has max key size 512 bytes
                    # can change but larger keys mean performance issues
                    continue


def prepare_lmdb_species_database(filename: str):
    with open(path.join(directory, filename), 'r') as f:
        map_size = 1099511627776
        env = lmdb.open(path.join(directory, 'lmdb/species'), map_size=map_size, max_dbs=2)
        db = env.open_db(SPECIES_NCBI_LMDB.encode('utf-8'), dupsort=True)

        with env.begin(db=db, write=True) as transaction:
            reader = csv.reader(f, delimiter='\t', quotechar='"')
            # skip headers
            # tax_id	rank	category	name	name_class
            headers = next(reader)
            for line in reader:
                # synonyms already have their own line in dataset
                #
                species_id = line[0]
                species_category = line[2]
                species_name = line[3]

                species = create_ner_type_species(
                    id_=species_id,
                    category=species_category if species_category else 'Uncategorized',
                    name=species_name,
                    synonym=species_name,
                )

                try:
                    transaction.put(
                        normalize_str(species_name).encode('utf-8'),
                        json.dumps(species).encode('utf-8'))
                except lmdb.BadValsizeError:
                    # ignore any keys that are too large
                    # LMDB has max key size 512 bytes
                    # can change but larger keys mean performance issues
                    continue


def prepare_lmdb_diseases_database(filename: str):
    with open(path.join(directory, filename), 'r') as f:
        map_size = 1099511627776
        env = lmdb.open(path.join(directory, 'lmdb/diseases'), map_size=map_size, max_dbs=2)
        db = env.open_db(DISEASES_MESH_LMDB.encode('utf-8'), dupsort=True)

        with env.begin(db=db, write=True) as transaction:
            reader = csv.reader(f, delimiter='\t', quotechar='"')
            # skip headers
            # MeshID	Name	Synonym
            headers = next(reader)
            for line in reader:
                disease_id = line[0]
                disease_name = line[1]
                synonym = line[2]

                disease = create_ner_type_disease(
                    id_=disease_id, name=disease_name, synonym=synonym)

                try:
                    transaction.put(
                        normalize_str(synonym).encode('utf-8'),
                        json.dumps(disease).encode('utf-8'))
                except lmdb.BadValsizeError:
                    # ignore any keys that are too large
                    # LMDB has max key size 512 bytes
                    # can change but larger keys mean performance issues
                    continue


def prepare_lmdb_phenomenas_database(filename: str):
    with open(path.join(directory, filename), 'r') as f:
        map_size = 1099511627776
        env = lmdb.open(path.join(directory, 'lmdb/phenomenas'), map_size=map_size, max_dbs=2)
        db = env.open_db(PHENOMENAS_MESH_LMDB.encode('utf-8'), dupsort=True)

        with env.begin(db=db, write=True) as transaction:
            reader = csv.reader(f, delimiter='\t', quotechar='"')
            # skip headers
            # mesh_id,name,synonym
            headers = next(reader)
            for line in reader:
                phenomena_id = line[0]
                phenomena_name = line[1]
                synonym = line[2]

                phenomena = create_ner_type_phenomena(
                    id_=phenomena_id,
                    name=phenomena_name,
                    synonym=synonym
                )

                try:
                    transaction.put(
                        normalize_str(synonym).encode('utf-8'),
                        json.dumps(phenomena).encode('utf-8'),
                    )
                except lmdb.BadValsizeError:
                    # ignore any keys that are too large
                    # LMDB has max key size 512 bytes
                    # can change but larger keys mean performance issues
                    continue


def prepare_lmdb_phenotypes_database(filename: str):
    with open(path.join(directory, filename), 'r') as f:
        map_size = 1099511627776
        env = lmdb.open(path.join(directory, 'lmdb/phenotypes'), map_size=map_size, max_dbs=2)
        db = env.open_db(PHENOTYPES_CUSTOM_LMDB.encode('utf-8'), dupsort=True)

        with env.begin(db=db, write=True) as transaction:
            reader = csv.reader(f, delimiter='\t', quotechar='"')
            # skip headers
            # mesh_id,name,synonym
            headers = next(reader)
            for line in reader:
                phenotype_id = line[0]
                phenotype_name = line[1]
                synonym = line[2]

                phenotype = create_ner_type_phenotype(
                    id_=phenotype_id,
                    name=phenotype_name,
                    synonym=synonym
                )

                try:
                    transaction.put(
                        normalize_str(synonym).encode('utf-8'),
                        json.dumps(phenotype).encode('utf-8'),
                    )
                except lmdb.BadValsizeError:
                    # ignore any keys that are too large
                    # LMDB has max key size 512 bytes
                    # can change but larger keys mean performance issues
                    continue


def prepare_lmdb_foods_database(filename: str):
    with open(path.join(directory, filename), 'r') as f:
        map_size = 1099511627776
        env = lmdb.open(path.join(directory, 'lmdb/foods'), map_size=map_size, max_dbs=2)
        db = env.open_db(FOODS_MESH_LMDB.encode('utf-8'), dupsort=True)

        with env.begin(db=db, write=True) as transaction:
            reader = csv.reader(f, delimiter='\t', quotechar='"')
            # skip headers
            # MeshID	Name	Synonym
            headers = next(reader)
            for line in reader:
                foods_id = line[0]
                foods_name = line[1]
                foods_synonym = line[2]

                foods = create_ner_type_food(
                    id_=foods_id,
                    name=foods_name,
                    synonym=foods_synonym,
                )

                try:
                    transaction.put(
                        normalize_str(foods_synonym).encode('utf-8'),
                        json.dumps(foods).encode('utf-8'))
                except lmdb.BadValsizeError:
                    # ignore any keys that are too large
                    # LMDB has max key size 512 bytes
                    # can change but larger keys mean performance issues
                    continue


def prepare_lmdb_anatomy_database(filename: str):
    with open(path.join(directory, filename), 'r') as f:
        map_size = 1099511627776
        env = lmdb.open(path.join(directory, 'lmdb/anatomy'), map_size=map_size, max_dbs=2)
        db = env.open_db(ANATOMY_MESH_LMDB.encode('utf-8'), dupsort=True)

        with env.begin(db=db, write=True) as transaction:
            reader = csv.reader(f, delimiter='\t', quotechar='"')
            # skip headers
            # MeshID	Name	Synonym
            headers = next(reader)
            for line in reader:
                anatomy_id = line[0]
                anatomy_name = line[1]
                anatomy_synonym = line[2]

                anatomy = create_ner_type_anatomy(
                    id_=anatomy_id,
                    name=anatomy_name,
                    synonym=anatomy_synonym,
                )

                try:
                    transaction.put(
                        normalize_str(anatomy_synonym).encode('utf-8'),
                        json.dumps(anatomy).encode('utf-8'))
                except lmdb.BadValsizeError:
                    # ignore any keys that are too large
                    # LMDB has max key size 512 bytes
                    # can change but larger keys mean performance issues
                    continue


if __name__ == '__main__':
    # delete all .mdb files before calling functions
    # otherwise can potentially result in finding
    # keys that already exists.
    #
    # there are common synonyms used across
    # different common names
    # so any common synonyms will then append
    # the common name to the list.
    #
    # so if we don't clean up before running
    # these functions, can falsely add to the
    # common name lists.
    for parent, subfolders, filenames in walk(path.join(directory, 'lmdb/')):
        for fn in filenames:
            if fn.lower().endswith('.mdb'):
                print(f'Deleting {path.join(parent, fn)}...')
                remove(path.join(parent, fn))

    # anatomy
    prepare_lmdb_anatomy_database(filename='datasets/anatomy.tsv')

    # chemical
    prepare_lmdb_chemicals_database(filename='datasets/chebi.tsv')

    # compound
    prepare_lmdb_compounds_database(filename='datasets/compounds.csv')

    # gene
    prepare_lmdb_genes_database(filename='datasets/genes.tsv')
    prepare_lmdb_genes_database(filename='datasets/pseudomonasCyc_genes.tsv')

    # disease
    prepare_lmdb_diseases_database(filename='datasets/disease.tsv')

    # food
    prepare_lmdb_foods_database(filename='datasets/food.tsv')

    # phenomena
    prepare_lmdb_phenomenas_database(filename='datasets/phenomena.tsv')

    # phenotype
    prepare_lmdb_phenotypes_database(filename='datasets/phenotype.tsv')

    # protein
    prepare_lmdb_proteins_database(filename='datasets/proteins.tsv')
    prepare_lmdb_proteins_database(filename='datasets/sprot2syn_gene.tsv')

    # organism
    prepare_lmdb_species_database(filename='datasets/taxonomy.tsv')
    prepare_lmdb_species_database(filename='datasets/covid19_taxonomy2.tsv')
