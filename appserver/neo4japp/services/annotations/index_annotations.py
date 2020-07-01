import os
import json
import lmdb
import sys

from collections import deque
from getopt import getopt, GetoptError

from elasticsearch import Elasticsearch
from elasticsearch.helpers import parallel_bulk

from neo4japp.services.annotations.constants import (
    CHEMICALS_CHEBI_LMDB,
    COMPOUNDS_BIOCYC_LMDB,
    DISEASES_MESH_LMDB,
    GENES_NCBI_LMDB,
    PHENOTYPES_MESH_LMDB,
    PROTEINS_UNIPROT_LMDB,
    SPECIES_NCBI_LMDB,
)


def process_lmdb(env, db, entity_type):
    with env.begin(db=db) as transaction:
        cursor = transaction.cursor()
        for i, (key, value) in enumerate(cursor.iternext()):
            data = json.loads(value.decode('utf-8'))
            yield {
                '_id': i+1,
                '_index': entity_type,
                '_source': {
                    'id': key.decode('utf-8'),
                    'data': data
                }
            }


def print_help():
    help_str = """
    index_annotations.py

    -a                          index all annotations
    -n <lmdb_name>              index specific annotation

    Current LMDB names include:
        chemicals
        compounds
        diseases
        genes
        phenotypes
        proteins
        species
    """
    print(help_str)


def _open_env(parentdir, db_name):
    env = lmdb.open(parentdir, readonly=True, max_dbs=2)
    db = env.open_db(db_name.encode('utf-8'), dupsort=True)

    return env, db


def open_env(entity_type, parentdir):
    if entity_type == 'chemicals':
        env, db = _open_env(parentdir, CHEMICALS_CHEBI_LMDB)
    elif entity_type == 'compounds':
        env, db = _open_env(parentdir, COMPOUNDS_BIOCYC_LMDB)
    elif entity_type == 'diseases':
        env, db = _open_env(parentdir, DISEASES_MESH_LMDB)
    elif entity_type == 'genes':
        env, db = _open_env(parentdir, GENES_NCBI_LMDB)
    elif entity_type == 'phenotypes':
        env, db = _open_env(parentdir, PHENOTYPES_MESH_LMDB)
    elif entity_type == 'proteins':
        env, db = _open_env(parentdir, PROTEINS_UNIPROT_LMDB)
    elif entity_type == 'species':
        env, db = _open_env(parentdir, SPECIES_NCBI_LMDB)
    else:
        print_help()
        sys.exit(2)
    return env, db


def main(argv):
    directory = os.path.realpath(os.path.dirname(__file__))

    es = Elasticsearch(hosts=['http://elasticsearch'], timeout=5000)

    try:
        opts, args = getopt(argv, 'an:')
    except GetoptError:
        print_help()
        sys.exit(2)

    if opts:
        opt, entity_type = opts[0]

        if opt == '-n':
            parentdir = os.path.join(directory, f'lmdb/{entity_type}')

            env, db = open_env(entity_type, parentdir)

            print(f'Processing {parentdir}')
            # first delete the index
            es.indices.delete(index=entity_type, ignore=[404])
            deque(parallel_bulk(es, process_lmdb(env, db, entity_type)), maxlen=0)
            env.close()
        elif opt == '-a':
            for parentdir, subdirs, files in os.walk(os.path.join(directory, 'lmdb')):
                if 'data.mdb' in files:
                    print(f'Processing {parentdir}')
                    entity_type = parentdir.split('/')[-1]

                    env, db = open_env(entity_type, parentdir)

                    # first delete the index
                    es.indices.delete(index=entity_type, ignore=[404])
                    deque(parallel_bulk(es, process_lmdb(env, db, entity_type)), maxlen=0)
                    env.close()
        else:
            print_help()
            sys.exit(2)
    else:
        print_help()
        sys.exit(2)


if __name__ == '__main__':
    main(sys.argv[1:])
