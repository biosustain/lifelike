"""This file should be executed during first deployment,
or whenever the LMDB databases in this file needs reset, or
fixed.

Any new LMDB env should use LMDBDAO() instead.
"""
import csv
import lmdb
import json

from ast import literal_eval
from os import path, remove, walk

from neo4japp.services.annotations.constants import (
    CHEMICALS_CHEBI_LMDB,
    COMPOUNDS_BIOCYC_LMDB,
    DISEASES_MESH_LMDB,
    GENES_NCBI_LMDB,
    PHENOTYPES_MESH_LMDB,
    PROTEINS_UNIPROT_LMDB,
    CHEMICALS_PUBCHEM_LMDB,
    SPECIES_NCBI_LMDB,
    DatabaseType,
)
from neo4japp.services.annotations.lmdb_util import (
    create_chemical_for_ner,
    create_compound_for_ner,
    create_disease_for_ner,
    create_gene_for_ner,
    create_phenotype_for_ner,
    create_protein_for_ner,
    create_species_for_ner,
)
from neo4japp.services.annotations.util import normalize_str


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
            # gene_id	name	synonym	tax_id	tax_category
            headers = next(reader)
            for line in reader:
                gene_name = line[1]
                synonym = line[2]

                gene = create_gene_for_ner(name=gene_name, synonym=synonym)

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
            reader = csv.reader(f, delimiter=',', quotechar='"')
            # skip headers
            # n.chebi_id,n.common_name,n.synonyms
            headers = next(reader)
            for line in reader:
                chemical_id = line[0]
                chemical_name = line[1]
                synonyms = line[2].split('|')

                if chemical_name != 'null':
                    chemical = create_chemical_for_ner(
                        id_=chemical_id,
                        name=chemical_name,
                        synonym=chemical_name,
                    )

                    try:
                        transaction.put(
                            normalize_str(chemical_name).encode('utf-8'),
                            json.dumps(chemical).encode('utf-8'),
                        )

                        if synonyms:
                            for synonym_term in synonyms:
                                if synonym_term != 'null':
                                    normalized_key = normalize_str(synonym_term)

                                    synonym = create_chemical_for_ner(
                                        id_=chemical_id,
                                        name=chemical_name,
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
                    compound = create_compound_for_ner(
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

                                    synonym = create_compound_for_ner(
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
            # skip headers
            # Accession	ID	Name	NameType	TaxID
            headers = next(reader)
            for line in reader:
                # synonyms already have their own line in dataset
                #
                protein_id = line[1]
                protein_name = line[2] if 'Uncharacterized protein' not in line[2] else line[0]  # noqa
                # changed protein_id to protein_name for now (JIRA LL-671)
                # will eventually change back to protein_id
                protein = create_protein_for_ner(
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

                species = create_species_for_ner(
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
            reader = csv.reader(f, delimiter=',', quotechar='"')
            # skip headers
            # ID,DiseaseName,Synonym
            headers = next(reader)
            for line in reader:
                disease_id = line[0]
                disease_name = line[1]
                synonym = line[2]

                disease = create_disease_for_ner(
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


def prepare_lmdb_phenotypes_database(filename: str, custom: bool = False):
    with open(path.join(directory, filename), 'r') as f:
        map_size = 1099511627776
        env = lmdb.open(path.join(directory, 'lmdb/phenotypes'), map_size=map_size, max_dbs=2)
        db = env.open_db(PHENOTYPES_MESH_LMDB.encode('utf-8'), dupsort=True)

        with env.begin(db=db, write=True) as transaction:
            reader = csv.reader(f, delimiter=',', quotechar='"')
            # skip headers
            # line,mesh_id,name,synonym,tree
            headers = next(reader)
            for line in reader:
                phenotype_id = line[1]
                phenotype_name = line[2]
                # turn string repr list into list
                synonyms = literal_eval(line[3]) if line[3] else None

                phenotype = create_phenotype_for_ner(
                    id_=phenotype_id,
                    name=phenotype_name,
                    synonym=phenotype_name,
                    custom=custom,
                )

                try:
                    transaction.put(
                        normalize_str(phenotype_name).encode('utf-8'),
                        json.dumps(phenotype).encode('utf-8'),
                    )

                    if synonyms:
                        for synonym_term in synonyms:
                            normalized_key = normalize_str(synonym_term)

                            synonym = create_phenotype_for_ner(
                                id_=phenotype_id,
                                name=phenotype_name,
                                synonym=synonym_term,
                                custom=custom,
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

    prepare_lmdb_genes_database(filename='datasets/genes.tsv')
    prepare_lmdb_chemicals_database(filename='datasets/chebi.csv')
    prepare_lmdb_compounds_database(filename='datasets/compounds.csv')
    prepare_lmdb_proteins_database(filename='datasets/proteins.tsv')
    prepare_lmdb_species_database(filename='datasets/taxonomy.tsv')
    prepare_lmdb_diseases_database(filename='datasets/disease.csv')
    prepare_lmdb_phenotypes_database(filename='datasets/phenotype.csv')

    # covid-19
    prepare_lmdb_diseases_database(filename='datasets/covid19_disease.csv')
    prepare_lmdb_species_database(filename='datasets/covid19_taxonomy.tsv')

    prepare_lmdb_species_database(filename='datasets/cdiff_taxonomy.tsv')
    prepare_lmdb_species_database(filename='datasets/ecoli_taxonomy.tsv')
    prepare_lmdb_species_database(filename='datasets/pseudomonas_aerug_taxonomy.tsv')
    prepare_lmdb_species_database(filename='datasets/staph_aureus_taxonomy.tsv')
    prepare_lmdb_species_database(filename='datasets/yeast_taxonomy.tsv')

    prepare_lmdb_phenotypes_database(
        filename='datasets/microbial_phenotype.csv', custom=True)
