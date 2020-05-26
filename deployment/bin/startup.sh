#!/bin/sh

print_usage() {
    echo "
    ================================= USAGE =================================
    Used for starting up the staging or production environment

    -t          <target: either staging or production or demo>

    e.g. ->
        ./startup.sh -t staging (starts the staging process)
    =========================================================================
    "
}


set -o errexit                  # exit on command failure; use <cmd> || true to allow for exception
set -o nounset                  # exit when script tries to use undeclared variables

if [ $# -ne 2 ];
then
    echo "Illegal number of arguments -- you must include the following"
    print_usage && exit 1
fi

TARGET=""

while getopts "t:" flag; do
    case "${flag}" in
        t) TARGET="${OPTARG}";;
        *) print_usage && exit 1;;
    esac
done

if [ "$TARGET" = staging ]
then
    echo "Starting up staging"
    cd /srv
    export $(cat staging.env | xargs)
    sudo docker login -u $DOCKER_USER -p "$(cat keyfile.json)" https://gcr.io
    sudo docker pull gcr.io/$PROJECT_ID/kg-appserver-staging:latest
    sudo docker pull gcr.io/$PROJECT_ID/kg-webserver-staging:latest
    sudo docker pull gcr.io/$PROJECT_ID/kg-cache-service-staging:latest
    sudo gsutil cp gs://kg-secrets/docker-compose.ci.yml docker-compose.ci.yml
    sudo docker-compose -f docker-compose.ci.yml up -d
fi

if [ "$TARGET" = demo ]
then
    echo "Starting up production"
    cd /srv
    export $(cat demo.env | xargs)
    sudo docker login -u $DOCKER_USER -p "$(cat keyfile.json)" https://gcr.io
    sudo docker pull gcr.io/$PROJECT_ID/kg-appserver-demo:latest
    sudo docker pull gcr.io/$PROJECT_ID/kg-webserver-demo:latest
    sudo docker pull gcr.io/$PROJECT_ID/kg-cache-service-demo:latest
    sudo gsutil cp gs://kg-secrets/docker-compose.demo.yml docker-compose.demo.yml
    sudo docker-compose -f docker-compose.demo.yml up -d
fi

if [ "$TARGET" = production ]
then
    echo "Starting up production"
    cd /srv
    export $(cat prod.env | xargs)
    sudo docker login -u $DOCKER_USER -p "$(cat keyfile.json)" https://gcr.io
    sudo docker pull gcr.io/$PROJECT_ID/kg-appserver-prod:latest
    sudo docker pull gcr.io/$PROJECT_ID/kg-webserver-prod:latest
    sudo docker pull gcr.io/$PROJECT_ID/kg-cache-service-prod:latest
    sudo gsutil cp gs://kg-secrets/docker-compose.prod.yml docker-compose.prod.yml
    sudo docker-compose -f docker-compose.prod.yml up -d
fi
