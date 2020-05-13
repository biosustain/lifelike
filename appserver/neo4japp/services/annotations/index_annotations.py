import os
import json
from elasticsearch import Elasticsearch
import lmdb

directory = os.path.realpath(os.path.dirname(__file__))

es = Elasticsearch(hosts=['http://elasticsearch'], timeout=5000)
if not es.exists('annotations', 'annotations'):
    es.create(
        'annotations',
        'annotations',
        {}
    )

for subdirs, dirs, files in os.walk(os.path.join(directory, 'lmdb')):
    if 'data.mdb' in files:
        print(f'Processing {subdirs}'x½x½)
        db = lmdb.open(subdirs)
        type = subdirs.split('/')[-1]
        with db.begin() as transaction:
            cursor = transaction.cursor()
            for key, value in cursor.iternext():
                data = json.loads(value.decode('utf-8'))
                data['common_name'] = {
                    'id': next(iter(data['common_name'].keys())),
                    'normalized_str': next(iter(data['common_name'].values()))
                }
                entry = {'annotation': {
                            'id': key.decode('utf-8'),
                            'type': type,
                            'data': data
                            }
                         }
                es.index('annotations', entry)
