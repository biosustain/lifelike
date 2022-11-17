#!/bin/bash

cd ./seed_data

col=all_rels

# Note that we explicitly use the "***ARANGO_DB_NAME***" database when creating the collection, and before importing!
arangosh --server.password $ARANGO_ROOT_PASSWORD --server.database $LIFELIKE_DB_NAME --javascript.execute-string "db._createEdgeCollection('${col}')"

for f in e_*.json;
do
echo ${f}
time arangoimport --server.password $ARANGO_ROOT_PASSWORD --server.database $LIFELIKE_DB_NAME --file ${f} --type jsonl --collection ${col} &
done
