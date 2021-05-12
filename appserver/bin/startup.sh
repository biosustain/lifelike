#!/usr/bin/env bash

set -o errexit                  # exit on command failure; use <cmd> || true to allow for exception
set -o nounset                  # exit when script tries to use undeclared variables

if [ "${FLASK_ENV}" = "development" ] && [ "${FLASK_APP_CONFIG}" = "Development" ]; then
    echo "### Starting up development environment ###"
    __dir__="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    # wait for postgres
    ${__dir__}/wait-for-postgres
    # # wait for neo4j
    # ${__dir__}/wait-for-neo4j # TODO: Move to makefile
    # # #wait for elastic       # TODO: Move to makefile
    # ${__dir__}/wait-for-elastic
    # setup db
    ${__dir__}/dev-db-setup
    # Start in server directory
    cd "${__dir__}/.."
    # Mark ready
    touch .READY
    flask run --host 0.0.0.0
elif [ "${FLASK_APP_CONFIG}" = "Production" ] || [ "${FLASK_APP_CONFIG}" = "Staging" ] || [ "${FLASK_APP_CONFIG}" = "QA" ]; then
    flask load-lmdb
    gunicorn -b 0.0.0.0:5000 --workers=9 --threads=25 app:app --timeout 1200
else
    echo "No environment setup for ${FLASK_ENV}"
fi
