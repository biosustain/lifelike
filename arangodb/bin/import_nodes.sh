#!/bin/bash

cd ./seed_data

for f in c_*.json;
do
col=`echo ${f} | sed 's/^c_*//' | sed 's/_nodes//' | sed 's/\.json$//'`
echo ${col}

# Note that we explicitly use the "***ARANGO_DB_NAME***" database when creating the collection, and before importing!
arangosh --server.password $ARANGO_ROOT_PASSWORD --server.database $LIFELIKE_DB_NAME --javascript.execute-string "db._createDocumentCollection('${col}')"
time arangoimport --server.password $ARANGO_ROOT_PASSWORD --server.database $LIFELIKE_DB_NAME --file ${f} --type jsonl --collection ${col} &
done
