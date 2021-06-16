#!/usr/bin/env bash

set -o errexit                  # exit on command failure; use <cmd> || true to allow for exception
set -o nounset                  # exit when script tries to use undeclared variables

if [ "${FLASK_ENV}" = "development" ] && [ "${FLASK_APP_CONFIG}" = "Development" ]; then
    flask run --host 0.0.0.0 -p 5010
elif [ "${FLASK_APP_CONFIG}" = "Production" ] || [ "${FLASK_APP_CONFIG}" = "Staging" ] || [ "${FLASK_APP_CONFIG}" = "QA" ]; then
    gunicorn -b 0.0.0.0:5010 --workers=2 --max-requests=200 statistical_enrichment:app --timeout 1200
else
    echo "No environment setup for ${FLASK_ENV}"
fi
