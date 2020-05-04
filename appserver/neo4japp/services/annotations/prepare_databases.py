"""This file should be executed during first deployment,
or whenever the LMDB databases in this file needs reset, or
fixed.

Any new LMDB env should use LMDBDAO() instead.
"""
import csv
import lmdb
import json

from os import path, remove, walk

from neo4japp.services.annotations.util import normalize_str


# reference to this directory
directory = path.realpath(path.dirname(__file__))


def prepare_lmdb_genes_database(filename: str):
    with open(path.join(directory, filename), 'r') as f:
        map_size = 1099511627776
        db = lmdb.open(path.join(directory, 'lmdb/genes'), map_size=map_size)
        with db.begin(write=True) as transaction:
            reader = csv.reader(f, delimiter='\t', quotechar='"')
            # skip headers
            # name	gene_id	tax_id
            headers = next(reader)
            for line in reader:
                gene_id = line[1]
                tax_id = line[2]
                gene_name = line[0]

                gene = {
                    'gene_id': gene_id,
                    'id_type': 'NCBI',
                    'tax_id': tax_id,
                    'name': gene_name,
                    'common_name': {gene_id: normalize_str(gene_name)},
                }

                try:
                    transaction.put(
                        normalize_str(gene_name).encode('utf-8'),
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
        db = lmdb.open(path.join(directory, 'lmdb/chemicals'), map_size=map_size)
        with db.begin(write=True) as transaction:
            reader = csv.reader(f, delimiter=',', quotechar='"')
            # skip headers
            # n.chebi_id,n.common_name,n.synonyms
            headers = next(reader)
            synonyms_list = []
            for line in reader:
                chemical_id = line[0]
                chemical_name = line[1]
                synonyms = line[2].split('|')

                chemical = {
                    'chemical_id': chemical_id,
                    'id_type': 'CHEBI',
                    'name': chemical_name,
                    'common_name': {
                        chemical_id: normalize_str(chemical_name),
                    } if chemical_name != 'null' else {},
                }

                if synonyms:
                    for syn in synonyms:
                        synonyms_list.append((syn, chemical))

                try:
                    if chemical_name != 'null':
                        transaction.put(
                            normalize_str(chemical_name).encode('utf-8'),
                            json.dumps(chemical).encode('utf-8'),
                        )
                except lmdb.BadValsizeError:
                    # ignore any keys that are too large
                    # LMDB has max key size 512 bytes
                    # can change but larger keys mean performance issues
                    continue

            # add all synonyms into LMDB
            # the reason is because a synonym could be a
            # common name, so we add those first
            for syn, chemical in synonyms_list:
                try:
                    if syn != 'null':
                        entity = transaction.get(normalize_str(syn).encode('utf-8'))
                        if entity:
                            entity = json.loads(entity)
                            entity['common_name'] = {
                                **entity['common_name'], **chemical['common_name']}
                            transaction.put(
                                normalize_str(syn).encode('utf-8'),
                                json.dumps(entity).encode('utf-8'))
                        else:
                            chemical['name'] = syn
                            transaction.put(
                                normalize_str(syn).encode('utf-8'),
                                json.dumps(chemical).encode('utf-8'))
                except lmdb.BadValsizeError:
                    continue


def prepare_lmdb_compounds_database(filename: str):
    with open(path.join(directory, filename), 'r') as f:
        map_size = 1099511627776
        db = lmdb.open(path.join(directory, 'lmdb/compounds'), map_size=map_size)
        with db.begin(write=True) as transaction:
            reader = csv.reader(f, delimiter=',', quotechar='"')
            # skip headers
            # n.biocyc_id,n.common_name,n.synonyms
            headers = next(reader)
            synonyms_list = []
            for line in reader:
                compound_id = line[0]
                compound_name = line[1]
                synonyms = line[2].split('|')

                compound = {
                    'compound_id': compound_id,
                    'id_type': 'BIOCYC',
                    'name': compound_name,
                    'common_name': {
                        compound_id: normalize_str(compound_name),
                    } if compound_name != 'null' else {},
                }

                if synonyms:
                    for syn in synonyms:
                        synonyms_list.append((syn, compound))

                try:
                    if compound_name != 'null':
                        transaction.put(
                            normalize_str(compound_name).encode('utf-8'),
                            json.dumps(compound).encode('utf-8'),
                        )
                except lmdb.BadValsizeError:
                    # ignore any keys that are too large
                    # LMDB has max key size 512 bytes
                    # can change but larger keys mean performance issues
                    continue

            # add all synonyms into LMDB
            # the reason is because a synonym could be a
            # common name, so we add those first
            for syn, compound in synonyms_list:
                try:
                    if syn != 'null':
                        entity = transaction.get(normalize_str(syn).encode('utf-8'))
                        if entity:
                            entity = json.loads(entity)
                            entity['common_name'] = {
                                **entity['common_name'], **compound['common_name']}
                            transaction.put(
                                normalize_str(syn).encode('utf-8'),
                                json.dumps(entity).encode('utf-8'))
                        else:
                            compound['name'] = syn
                            transaction.put(
                                normalize_str(syn).encode('utf-8'),
                                json.dumps(compound).encode('utf-8'))
                except lmdb.BadValsizeError:
                    continue


def prepare_lmdb_proteins_database(filename: str):
    with open(path.join(directory, filename), 'r') as f:
        map_size = 1099511627776
        db = lmdb.open(path.join(directory, 'lmdb/proteins'), map_size=map_size)
        with db.begin(write=True) as transaction:
            reader = csv.reader(f, delimiter='\t', quotechar='"')
            # skip headers
            # Accession	ID	Name	NameType	TaxID
            headers = next(reader)
            for line in reader:
                # synonyms already have their own line in dataset
                protein_id = line[1]
                protein_name = line[2] if 'Uncharacterized protein' not in line[2] else line[0]  # noqa
                protein = {
                    'protein_id': protein_id,
                    'id_type': 'UNIPROT',
                    'name': protein_name,
                    'common_name': {
                        protein_id: normalize_str(protein_name),
                    } if protein_name != 'null' else {},
                }

                try:
                    if protein_name != 'null':
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
        db = lmdb.open(path.join(directory, 'lmdb/species'), map_size=map_size)
        with db.begin(write=True) as transaction:
            reader = csv.reader(f, delimiter='\t', quotechar='"')
            # skip headers
            # tax_id	rank	parent_tax_id	name	name_class
            headers = next(reader)
            for line in reader:
                if line[1] == 'species':
                    # synonyms already have their own line in dataset
                    species_id = line[0]
                    species_rank = line[1]
                    species_name = line[3]

                    species = {
                        'tax_id': species_id,
                        'id_type': 'NCBI',
                        'rank': species_rank,
                        'name': species_name,
                        'common_name': {species_id: normalize_str(species_name)},
                    }

                    try:
                        if species_name != 'null':
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
        db = lmdb.open(path.join(directory, 'lmdb/diseases'), map_size=map_size)
        with db.begin(write=True) as transaction:
            reader = csv.reader(f, delimiter=',', quotechar='"')
            # skip headers
            # ID,DiseaseName,Synonym
            headers = next(reader)
            synonyms_list = []
            for line in reader:
                disease_id = line[0]
                disease_name = line[1]
                synonym = line[2]

                disease = {
                    'disease_id': disease_id,
                    'id_type': 'MESH',
                    'name': disease_name,
                    'common_name': {
                        disease_id: normalize_str(disease_name),
                    } if disease_name != 'null' else {},
                }

                synonyms_list.append((synonym, disease))

                try:
                    if disease_name != 'null':
                        transaction.put(
                            normalize_str(disease_name).encode('utf-8'),
                            json.dumps(disease).encode('utf-8'))
                except lmdb.BadValsizeError:
                    # ignore any keys that are too large
                    # LMDB has max key size 512 bytes
                    # can change but larger keys mean performance issues
                    continue

            # add all synonyms into LMDB
            # the reason is because a synonym could be a
            # common name, so we add those first
            for syn, disease in synonyms_list:
                try:
                    if syn != 'null':
                        entity = transaction.get(normalize_str(syn).encode('utf-8'))
                        if entity:
                            entity = json.loads(entity)
                            entity['common_name'] = {
                                **entity['common_name'], **disease['common_name']}
                            transaction.put(
                                normalize_str(syn).encode('utf-8'),
                                json.dumps(entity).encode('utf-8'))
                        else:
                            disease['name'] = syn
                            transaction.put(
                                normalize_str(syn).encode('utf-8'),
                                json.dumps(disease).encode('utf-8'))
                except lmdb.BadValsizeError:
                    continue


def prepare_lmdb_phenotypes_database(filename: str):
    with open(path.join(directory, filename), 'r') as f:
        map_size = 1099511627776
        db = lmdb.open(path.join(directory, 'lmdb/phenotype'), map_size=map_size)
        with db.begin(write=True) as transaction:
            reader = csv.reader(f, delimiter=',', quotechar='"')
            # skip headers
            # line,mesh_id,name,synonym,tree
            headers = next(reader)
            synonyms_list = []
            for line in reader:
                phenotype_id = line[1]
                phenotype_name = line[2]
                synonyms = line[3]

                phenotype = {
                    'phenotype_id': phenotype_id,
                    'id_type': 'MESH',
                    'name': phenotype_name,
                    'common_name': {
                        phenotype_id: normalize_str(phenotype_name),
                    } if phenotype_name != 'null' else {},
                }

                if synonyms:
                    for syn in synonyms:
                        synonyms_list.append((syn, phenotype))

                try:
                    transaction.put(
                        normalize_str(phenotype_name).encode('utf-8'),
                        json.dumps(phenotype).encode('utf-8'))
                except lmdb.BadValsizeError:
                    # ignore any keys that are too large
                    # LMDB has max key size 512 bytes
                    # can change but larger keys mean performance issues
                    continue

            # add all synonyms into LMDB
            # the reason is because a synonym could be a
            # common name, so we add those first
            for syn, phenotype in synonyms_list:
                try:
                    if syn != 'null':
                        entity = transaction.get(normalize_str(syn).encode('utf-8'))
                        if entity:
                            entity = json.loads(entity)
                            entity['common_name'] = {
                                **entity['common_name'], **phenotype['common_name']}
                            transaction.put(
                                normalize_str(syn).encode('utf-8'),
                                json.dumps(entity).encode('utf-8'))
                        else:
                            phenotype['name'] = syn
                            transaction.put(
                                normalize_str(syn).encode('utf-8'),
                                json.dumps(phenotype).encode('utf-8'))
                except lmdb.BadValsizeError:
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
