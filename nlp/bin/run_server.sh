#!/usr/bin/env bash
set -e

echo "Running development server"
flask run --host 0.0.0.0 -p 5001
