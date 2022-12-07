#!/bin/bash

# Create and swap to ***ARANGO_DB_NAME*** database
arangosh --server.password $ARANGO_ROOT_PASSWORD --javascript.execute-string "db._createDatabase('${LIFELIKE_DB_NAME}')"

# Create/seed document collections
sh ./import_nodes.sh

# Create/seed edge collections
sh ./import_edges.sh
