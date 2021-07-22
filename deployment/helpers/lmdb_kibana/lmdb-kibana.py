""" LMDB Kibana
Script is used for downloading the latest LMDB databases from
Google Cloud Storage Bucket and indexing the data into an
Elasticsearch service. The data can then be viewed in Kibana.
TODO: Convert this into an Ansible playbook
"""

import os
import sys
import argparse
import lmdb
import json
import time
from collections import deque
from elasticsearch import Elasticsearch
from elasticsearch.helpers import parallel_bulk


ANATOMY_LMDB = 'anatomy_lmdb'
CHEMICALS_LMDB = 'chemicals_lmdb'
CHEMICALS_PUBCHEM_LMDB = 'chemicals_pubchem'
COMPOUNDS_LMDB = 'compounds_lmdb'
DISEASES_LMDB = 'diseases_lmdb'
FOODS_LMDB = 'foods_lmdb'
GENES_LMDB = 'genes_lmdb'
PHENOMENAS_LMDB = 'phenomenas_lmdb'
PHENOTYPES_LMDB = 'phenotypes_lmdb'
PROTEINS_LMDB = 'proteins_lmdb'
SPECIES_LMDB = 'species_lmdb'


def _open_env(parentdir, db_name):
    env = lmdb.open(parentdir, readonly=True, max_dbs=1)
    db = env.open_db(db_name.encode('utf-8'), dupsort=True)
    return env, db


def open_env(entity_type, parentdir):
    if entity_type == 'anatomy':
        env, db = _open_env(parentdir, ANATOMY_LMDB)
    elif entity_type == 'chemicals':
        env, db = _open_env(parentdir, CHEMICALS_LMDB)
    elif entity_type == 'compounds':
        env, db = _open_env(parentdir, COMPOUNDS_LMDB)
    elif entity_type == 'diseases':
        env, db = _open_env(parentdir, DISEASES_LMDB)
    elif entity_type == 'foods':
        env, db = _open_env(parentdir, FOODS_LMDB)
    elif entity_type == 'genes':
        env, db = _open_env(parentdir, GENES_LMDB)
    elif entity_type == 'phenomenas':
        env, db = _open_env(parentdir, PHENOMENAS_LMDB)
    elif entity_type == 'phenotypes':
        env, db = _open_env(parentdir, PHENOTYPES_LMDB)
    elif entity_type == 'proteins':
        env, db = _open_env(parentdir, PROTEINS_LMDB)
    elif entity_type == 'species':
        env, db = _open_env(parentdir, SPECIES_LMDB)
    else:
        sys.exit(2)
    return env, db


def process_lmdb(env, db, entity_type):
    with env.begin(db=db) as transaction:
        cursor = transaction.cursor()
        for i, (k, v) in enumerate(cursor):
            data = json.loads(v.decode('utf-8'))
            yield {
                '_index': f'lmdb-{entity_type}',
                '_source': {
                    'id': k.decode('utf-8'),
                    'data': data,
                }
            }


parser = argparse.ArgumentParser(
    description='Updates Elasticsearch/Kibana with LMDB data')
parser.add_argument(
    'path',
    help='parent directory of lmdb files')
parser.add_argument(
    '--secrets',
    help='secrets file',
    default='servers.json')

args = parser.parse_args()

with open(args.secrets, 'r') as fi:
    secrets = json.load(fi)
    es_host = secrets['elasticsearch']

t0 = time.time()

es = Elasticsearch(hosts=[es_host], timeout=5000)

for entity in os.listdir(args.path):
    print(f'Processing... {entity}')
    entity_base_path = os.path.join(args.path, entity)
    env, db = open_env(entity, entity_base_path)
    es.indices.delete(index=f'lmdb-{entity}', ignore=[404])
    es.indices.create(index=f'lmdb-{entity}')
    process_lmdb(env, db, entity)
    deque(parallel_bulk(
        client=es,
        actions=process_lmdb(env, db, entity),
        chunk_size=10000,
        thread_count=4,
        queue_size=4,
        max_chunk_bytes=10 * 1024 * 1024,
    ), maxlen=0)
    env.close()

t1 = time.time()
total = t1-t0

print(f'Finished uploading LMDB to {es_host}')
print(f'Total run time: {total}')
