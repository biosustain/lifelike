#!/bin/bash

# https://adamcowley.co.uk/neo4j/neo4j-docker-seed-backup/
echo "Running restore"
mkdir -p /var/lib/neo4j/data/databases/graph.db
neo4j-admin load --from=./backups/dev-backup.dump --database=graph.db --force

/docker-entrypoint.sh neo4j