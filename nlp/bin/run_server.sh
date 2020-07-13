#!/usr/bin/env bash
set -e

if [ "$FLASK_ENV" = "development" ]
then
    echo "Running development server"
    flask run --host 0.0.0.0 -p 5001
fi

if [ "$FLASK_ENV" = "production" ]
then
    echo "Running production server"
    gunicorn -b 0.0.0.0:5001 -w 4 app:app --timeout 1200
fi
