#!/usr/bin/env bash
set -e

bindir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"

dir="${bindir}/.."
find ${dir} -type f -name "*.py[co]" -delete
find ${dir} -depth -type d -name "__pycache__" -exec rm -rf "{}" \;

exec "flask" "run" "--host" "0.0.0.0"
