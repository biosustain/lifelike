#!/usr/bin/env bash

set -o errexit                  # exit on command failure; use <cmd> || true to allow for exception
set -o nounset                  # exit when script tries to use undeclared variables

echo "### Starting up cache-invalidator ###"
__dir__="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# wait for arango
timeout 300 ${__dir__}/wait-for-arango.sh
python ${__dir__}/../main.py
