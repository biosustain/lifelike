#!/bin/bash

# useful to have APOC procedures
# https://neo4j.com/labs/apoc/4.2/installation/#apoc-core
cp /var/lib/neo4j/labs/apoc-4.2.0.7-core.jar /var/lib/neo4j/plugins/

/docker-entrypoint.sh neo4j
