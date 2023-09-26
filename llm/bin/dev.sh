#!/usr/bin/env bash

set -o errexit                  # exit on command failure; use <cmd> || true to allow for exception
set -o nounset                  # exit when script tries to use undeclared variables

python -m jupyterlab --ip=0.0.0.0 --allow-***ARANGO_USERNAME*** --no-browser --port 8888
