#!/usr/bin/env bash

set -o errexit                  # exit on command failure; use <cmd> || true to allow for exception
set -o nounset                  # exit when script tries to use undeclared variables

if [ "${FLASK_ENV}" = "development" ]; then
    echo "### Starting up development environment ###"
    __dir__="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    # wait for postgres
    ${__dir__}/wait-for-postgres
    # wait for neo4j
    ${__dir__}/wait-for-neo4j
    #wait for elastic
    ${__dir__}/wait-for-elastic
    # setup db
    ${__dir__}/dev-db-setup
    # Start in server directory
    cd "${__dir__}/.."
    echo "### Downloading LMDB files & updating respective LMDB database tables ###"
    # Load lmdb data
    flask load-lmdb &
    # Mark ready
    touch .READY
    echo "### Setting up elastic indices ###"
    # Seed elastic indices
    flask seed-elastic &
    flask run --host 0.0.0.0
elif [ "${FLASK_ENV}" = "production" ]; then
    echo "### Setting up production environment ###"
    # Load lmdb data
    flask load-lmdb &
    echo "### Setting up elastic indices ###"
    # Seed elastic indices
    flask seed-elastic &
    gunicorn -b 0.0.0.0:5000 -w 4 app:app --timeout 1200
else
    echo "No environment setup for ${FLASK_ENV}"
fi
