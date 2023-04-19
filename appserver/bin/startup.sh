#!/usr/bin/env bash

set -o errexit                  # exit on command failure; use <cmd> || true to allow for exception
set -o nounset                  # exit when script tries to use undeclared variables

if [ "${FLASK_ENV}" = "development" ] && [ "${FLASK_APP_CONFIG}" = "Development" ]; then
    echo "### Starting up development environment ###"
    __dir__="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    # Start in server directory
    cd "${__dir__}/.."
    # Mark ready
    touch .READY
    flask run --host 0.0.0.0
elif [ "${FLASK_APP_CONFIG}" = "Production" ] || [ "${FLASK_APP_CONFIG}" = "Staging" ] || [ "${FLASK_APP_CONFIG}" = "QA" ]; then
    gunicorn -b 0.0.0.0:5000 --workers=9 --threads=10 --timeout 1200 --max-requests 200 app:app
else
    echo "No environment setup for ${FLASK_ENV}"
fi
