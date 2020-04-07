"""This file should be executed during first deployment,
or whenever the LMDB databases in this file needs reset, or
fixed.

Any new LMDB env should use LMDBDAO() instead.
"""
import csv
import lmdb
import json

from os import path, remove, walk


# reference to this directory
directory = path.realpath(path.dirname(__file__))


def prepare_lmdb_genes_database():
    with open(path.join(directory, 'datasets/genes.tsv'), 'r') as f:
        map_size = 1099511627776
        db = lmdb.open(path.join(directory, 'lmdb/genes'), map_size=map_size)
        with db.begin(write=True) as transaction:
            reader = csv.reader(f, delimiter='\t', quotechar='"')
            # skip headers
            headers = next(reader)
            for line in reader:
                gene = {
                    'gene_id': line[1],
                    'id_type': 'NCBI',
                    'tax_id': line[2],
                    'common_name': {line[1]: line[0].lower()},
                }

                try:
                    transaction.put(
                        line[0].lower().encode('utf-8'), json.dumps(gene).encode('utf-8'))
                except lmdb.BadValsizeError:
                    # ignore any keys that are too large
                    # LMDB has max key size 512 bytes
                    # can change but larger keys mean performance issues
                    continue


def prepare_lmdb_chemicals_database():
    with open(path.join(directory, 'datasets/chebi.csv'), 'r') as f:
        map_size = 1099511627776
        db = lmdb.open(path.join(directory, 'lmdb/chemicals'), map_size=map_size)
        with db.begin(write=True) as transaction:
            reader = csv.reader(f, delimiter=',', quotechar='"')
            # skip headers
            headers = next(reader)
            synonyms_list = []
            for line in reader:
                synonyms = line[2].split('|')
                chemical = {
                    'chemical_id': line[0],
                    'id_type': 'CHEBI',
                    'common_name': {line[0]: line[1].lower()} if line[1] != 'null' else {},
                }

                if synonyms:
                    for syn in synonyms:
                        synonyms_list.append((syn, chemical))

                try:
                    if line[1] != 'null':
                        transaction.put(
                            line[1].lower().encode('utf-8'), json.dumps(chemical).encode('utf-8'))
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
                        entity = transaction.get(syn.lower().encode('utf-8'))
                        if entity:
                            entity = json.loads(entity)
                            entity['common_name'] = {
                                **entity['common_name'], **chemical['common_name']}
                            transaction.put(
                                syn.lower().encode('utf-8'),
                                json.dumps(entity).encode('utf-8'))
                        else:
                            transaction.put(
                                syn.lower().encode('utf-8'),
                                json.dumps(chemical).encode('utf-8'))
                except lmdb.BadValsizeError:
                    continue


def prepare_lmdb_compounds_database():
    with open(path.join(directory, 'datasets/compounds.csv'), 'r') as f:
        map_size = 1099511627776
        db = lmdb.open(path.join(directory, 'lmdb/compounds'), map_size=map_size)
        with db.begin(write=True) as transaction:
            reader = csv.reader(f, delimiter=',', quotechar='"')
            # skip headers
            headers = next(reader)
            synonyms_list = []
            for line in reader:
                synonyms = line[2].split('|')
                compound = {
                    'compound_id': line[0],
                    'id_type': 'BIOCYC',
                    'common_name': {line[0]: line[1].lower()} if line[1] != 'null' else {},
                }

                if synonyms:
                    for syn in synonyms:
                        synonyms_list.append((syn, compound))

                try:
                    if line[1] != 'null':
                        transaction.put(
                            line[1].lower().encode('utf-8'), json.dumps(compound).encode('utf-8'))
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
                        entity = transaction.get(syn.lower().encode('utf-8'))
                        if entity:
                            entity = json.loads(entity)
                            entity['common_name'] = {
                                **entity['common_name'], **compound['common_name']}
                            transaction.put(
                                syn.lower().encode('utf-8'),
                                json.dumps(entity).encode('utf-8'))
                        else:
                            transaction.put(
                                syn.lower().encode('utf-8'),
                                json.dumps(compound).encode('utf-8'))
                except lmdb.BadValsizeError:
                    continue


def prepare_lmdb_proteins_database():
    with open(path.join(directory, 'datasets/proteins.csv'), 'r') as f:
        map_size = 1099511627776
        db = lmdb.open(path.join(directory, 'lmdb/proteins'), map_size=map_size)
        with db.begin(write=True) as transaction:
            reader = csv.reader(f, delimiter=',', quotechar='"')
            # skip headers
            headers = next(reader)
            synonyms_list = []
            for line in reader:
                # n.biocyc_id,n.common_name,n.synonyms
                synonyms = line[2].split('|')
                protein = {
                    'protein_id': line[0],
                    'id_type': 'BIOCYC',
                    'common_name': {line[0]: line[1].lower()} if line[1] != 'null' else {},
                }

                if synonyms:
                    for syn in synonyms:
                        synonyms_list.append((syn, protein))

                try:
                    if line[1] != 'null':
                        transaction.put(
                            line[1].lower().encode('utf-8'), json.dumps(protein).encode('utf-8'))
                except lmdb.BadValsizeError:
                    # ignore any keys that are too large
                    # LMDB has max key size 512 bytes
                    # can change but larger keys mean performance issues
                    continue

            # add all synonyms into LMDB
            # the reason is because a synonym could be a
            # common name, so we add those first
            for syn, protein in synonyms_list:
                try:
                    if syn != 'null':
                        entity = transaction.get(syn.lower().encode('utf-8'))
                        if entity:
                            entity = json.loads(entity)
                            entity['common_name'] = {
                                **entity['common_name'], **protein['common_name']}
                            transaction.put(
                                syn.lower().encode('utf-8'),
                                json.dumps(entity).encode('utf-8'))
                        else:
                            transaction.put(
                                syn.lower().encode('utf-8'),
                                json.dumps(protein).encode('utf-8'))
                except lmdb.BadValsizeError:
                    continue


def prepare_lmdb_species_database():
    with open(path.join(directory, 'datasets/taxonomy.tsv'), 'r') as f:
        map_size = 1099511627776
        db = lmdb.open(path.join(directory, 'lmdb/species'), map_size=map_size)
        with db.begin(write=True) as transaction:
            reader = csv.reader(f, delimiter='\t', quotechar='"')
            # skip headers
            headers = next(reader)
            for line in reader:
                if line[1] == 'species':
                    # synonyms already have their own line in dataset
                    species = {
                        'tax_id': line[0],
                        'id_type': 'NCBI',
                        'rank': line[1],
                        'common_name': {line[0]: line[3].lower()},
                    }

                    try:
                        if line[3] != 'null':
                            transaction.put(
                                line[3].lower().encode('utf-8'),
                                json.dumps(species).encode('utf-8'))
                    except lmdb.BadValsizeError:
                        # ignore any keys that are too large
                        # LMDB has max key size 512 bytes
                        # can change but larger keys mean performance issues
                        continue


def prepare_lmdb_diseases_database():
    with open(path.join(directory, 'datasets/disease.csv'), 'r') as f:
        map_size = 1099511627776
        db = lmdb.open(path.join(directory, 'lmdb/diseases'), map_size=map_size)
        with db.begin(write=True) as transaction:
            reader = csv.reader(f, delimiter=',', quotechar='"')
            # skip headers
            headers = next(reader)
            synonyms_list = []
            for line in reader:
                synonyms = line[2].split(',')
                disease = {
                    'disease_id': line[0],
                    'id_type': 'MESH',
                    'common_name': {line[0]: line[1].lower()} if line[1] != 'null' else {},
                }

                if synonyms:
                    for syn in synonyms:
                        synonyms_list.append((syn, disease))

                try:
                    if line[1] != 'null':
                        transaction.put(
                            line[1].lower().encode('utf-8'),
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
                        entity = transaction.get(syn.lower().encode('utf-8'))
                        if entity:
                            entity = json.loads(entity)
                            entity['common_name'] = {
                                **entity['common_name'], **disease['common_name']}
                            transaction.put(
                                syn.lower().encode('utf-8'),
                                json.dumps(entity).encode('utf-8'))
                        else:
                            transaction.put(
                                syn.lower().encode('utf-8'),
                                json.dumps(disease).encode('utf-8'))
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

    prepare_lmdb_genes_database()
    prepare_lmdb_chemicals_database()
    prepare_lmdb_compounds_database()
    prepare_lmdb_proteins_database()
    prepare_lmdb_species_database()
    prepare_lmdb_diseases_database()
