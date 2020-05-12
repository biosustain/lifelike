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
        db = lmdb.open(os.path.join(directory, subdirs))
        with db.begin() as transaction:
            cursor = transaction.cursor()
            for key, value in cursor.iternext():
                entry = {'annotation': key.decode('utf-8'),
                         'data': json.loads(value.decode('utf-8'))}
                es.index('annotations', entry)
