import os
import json
import lmdb

from collections import deque

from elasticsearch import Elasticsearch
from elasticsearch.helpers import parallel_bulk

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


def main():
    directory = os.path.realpath(os.path.dirname(__file__))

    es = Elasticsearch(hosts=['http://elasticsearch'], timeout=5000)

    for parentdir, subdirs, files in os.walk(os.path.join(directory, 'lmdb')):
        if 'data.mdb' in files:
            print(f'Processing {parentdir}')
            entity_type = parentdir.split('/')[-1]
            env = lmdb.open(parentdir, readonly=True, max_dbs=2)

            if entity_type == 'chemicals':
                db = env.open_db(CHEMICAL_LMDB.encode('utf-8'), dupsort=True)
            elif entity_type == 'compounds':
                db = env.open_db(COMPOUND_LMDB.encode('utf-8'), dupsort=True)
            elif entity_type == 'diseases':
                db = env.open_db(DISEASE_LMDB.encode('utf-8'), dupsort=True)
            elif entity_type == 'genes':
                db = env.open_db(GENE_LMDB.encode('utf-8'), dupsort=True)
            elif entity_type == 'phenotypes':
                db = env.open_db(PHENOTYPE_LMDB.encode('utf-8'), dupsort=True)
            elif entity_type == 'proteins':
                db = env.open_db(PROTEIN_LMDB.encode('utf-8'), dupsort=True)
            elif entity_type == 'pubchem':
                db = env.open_db(PUBCHEM_LMDB.encode('utf-8'), dupsort=True)
            elif entity_type == 'species':
                db = env.open_db(SPECIES_LMDB.encode('utf-8'), dupsort=True)

            deque(parallel_bulk(es, process_lmdb(env, db, entity_type)), maxlen=0)
            env.close()


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


main()
