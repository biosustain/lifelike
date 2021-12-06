#!/bin/bash
set -e

## This is a modified version of the official Docker entrypoint script.
## Ref: https://github.com/liquibase/docker/blob/ff6b4b8753d4a8a755521bf0e99bf3f03ecbfa08/docker-entrypoint.sh

if [[ "$INSTALL_MYSQL" ]]; then
  lpm add mysql --global
fi

if type "$1" > /dev/null 2>&1; then
  ## First argument is an actual OS command. Run it
  exec "$@"
else
  if [[ "$*" == *--defaultsFile* ]] || [[ "$*" == *--defaults-file* ]] || [[ "$*" == *--version* ]]; then
    ## Just run as-is
    liquibase "$@"
  else
    ## Include standard defaultsFile
    liquibase \
      --defaults-file=/liquibase/liquibase.docker.properties \
      --changelog-file=${CHANGELOG_FILE:-***ARANGO_DB_NAME***-graph/changelog-master.xml} \
      --url=jdbc:neo4j:bolt://$NEO4J_HOST?database=$NEO4J_DATABASE \
      --username=$NEO4J_USERNAME --password=$NEO4J_PASSWORD \
      --log-level=$LOG_LEVEL \
      "$@" \
      -Dneo4jHost=bolt://$NEO4J_HOST \
      -Dneo4jCredentials=$NEO4J_USERNAME,$NEO4J_PASSWORD \
      -Dneo4jDatabase=$NEO4J_DATABASE \
      -DazureStorageName=$STORAGE_AZURE_ACCOUNT_NAME \
      -DazureStorageKey=$STORAGE_AZURE_ACCOUNT_KEY \
      -DlocalSaveFileDir=/tmp
  fi
fi
