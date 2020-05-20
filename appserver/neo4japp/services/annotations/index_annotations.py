import os
import json
import lmdb
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk, parallel_bulk


def main():
    directory = os.path.realpath(os.path.dirname(__file__))

    es = Elasticsearch(hosts=['http://elasticsearch'], timeout=5000)

    for subdirs, dirs, files in os.walk(os.path.join(directory, 'lmdb')):
        if 'data.mdb' in files:
            process_lmdb(subdirs, es)


def process_lmdb(subdirs, es):
    print(f'Processing {subdirs}')
    db = lmdb.open(subdirs)
    type = subdirs.split('/')[-1]
    entries = []
    with db.begin() as transaction:
        cursor = transaction.cursor()
        for key, value in cursor.iternext():
            data = json.loads(value.decode('utf-8'))
            data['common_name'] = {
                'id': next(iter(data['common_name'].keys())),
                'normalized_str': next(iter(data['common_name'].values()))
            }
            entry = {
                        '_index': type,
                        '_source': {
                            'id': key.decode('utf-8'),
                            'data': data
                        }
                     }
            entries.append(entry)
    parallel_bulk(es, entries)


main()
