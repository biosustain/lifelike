#!/bin/sh

print_usage() {
    echo "
    ================================= USAGE =================================
    Used for starting up staging, production, or demo environment.

    required:

    -t          <target: either staging or production or demo>

    optional:

    -h          <hash: the github hash to revert to>

                This can be used to use a different Docker image
                on build by providing the git commit hash. All
                Docker images are tagged with the commit so
                this can be used to revert the services to an
                older version. (NOTE) This does not revert the
                database schema; database schemas must be handled
                separately else the application may not work.

    e.g. ->
        ./startup.sh -t staging (starts the staging process)
        ./startup.sh -t staging -h fe1f721 (starts staging with specific Git Hash)
    =========================================================================
    "
}


set -o errexit                  # exit on command failure; use <cmd> || true to allow for exception
set -o nounset                  # exit when script tries to use undeclared variables

if [ $# -lt 2 ];
then
    echo "Illegal number of arguments -- you must include the following"
    print_usage && exit 1
fi

TARGET=""
DOCKER_TAG="latest"

while getopts "t:h:" flag; do
    case "${flag}" in
        t) TARGET="${OPTARG}";;
        h) DOCKER_TAG="${OPTARG}";;
        *) print_usage && exit 1;;
    esac
done

if [ "$TARGET" = staging ]
then
    echo "Starting up staging"
    cd /srv
    export $(cat staging.env | xargs)
    sudo docker login -u $DOCKER_USER -p "$(cat keyfile.json)" https://gcr.io
    sudo docker pull gcr.io/$PROJECT_ID/kg-appserver-staging:$DOCKER_TAG
    sudo docker pull gcr.io/$PROJECT_ID/kg-webserver-staging:$DOCKER_TAG
    sudo docker pull gcr.io/$PROJECT_ID/kg-cache-service-staging:$DOCKER_TAG
    sudo gsutil cp gs://kg-secrets/docker-compose.staging.yml docker-compose.staging.yml
    sudo docker-compose -f docker-compose.staging.yml up -d
fi

if [ "$TARGET" = demo ]
then
    echo "Starting up demo"
    cd /srv
    export $(cat demo.env | xargs)
    sudo docker login -u $DOCKER_USER -p "$(cat keyfile.json)" https://gcr.io
    sudo docker pull gcr.io/$PROJECT_ID/kg-appserver-demo:$DOCKER_TAG
    sudo docker pull gcr.io/$PROJECT_ID/kg-webserver-demo:$DOCKER_TAG
    sudo docker pull gcr.io/$PROJECT_ID/kg-cache-service-demo:$DOCKER_TAG
    sudo gsutil cp gs://kg-secrets/docker-compose.demo.yml docker-compose.demo.yml
    sudo docker-compose -f docker-compose.demo.yml up -d
fi

if [ "$TARGET" = production ]
then
    echo "Starting up production"
    cd /srv
    export $(cat prod.env | xargs)
    sudo docker login -u $DOCKER_USER -p "$(cat keyfile.json)" https://gcr.io
    sudo docker pull gcr.io/$PROJECT_ID/kg-appserver-prod:$DOCKER_TAG
    sudo docker pull gcr.io/$PROJECT_ID/kg-webserver-prod:$DOCKER_TAG
    sudo docker pull gcr.io/$PROJECT_ID/kg-cache-service-prod:$DOCKER_TAG
    sudo gsutil cp gs://kg-secrets/docker-compose.prod.yml docker-compose.prod.yml
    sudo docker-compose -f docker-compose.prod.yml up -d
fi
