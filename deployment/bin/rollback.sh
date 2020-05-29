#!/bin/bash

print_usage() {
    echo "
    ================================= USAGE =================================
    Used for reverting staging, production, or demo to an older
    build. This uses the GitHub hash to track which Docker image
    to use as we tag each build with the master hash.

    This does NOT perform any database changes. Rolling back
    to an older image without performing the respective database
    changes can break the application.

    -t          <target: the google cloud VM alias (e.g. kg-staging)>
    -h          <hash: the github hash to revert to>

    e.g. ->
        ./rollback.sh -t kg-staging -h fe1f721
        (changes the infrastructure to use an older build based
         on the GitHub hash provided. DOES NOT CHANGE the database)
    =========================================================================
    "
}

set -o errexit                  # exit on command failure; use <cmd> || true to allow for exception
set -o nounset                  # exit when script tries to use undeclared variables

if [ $# -ne 4 ];
then
    echo "Illegal number of arguments -- you must include the following"
    print_usage && exit 1
fi

TARGET=""
GIT_HASH=""

while getopts "t:h:" flag; do
    case "${flag}" in
        t) TARGET="${OPTARG}";;
        h) GIT_HASH="${OPTARG}";;
        *) print_usage && exit 1;;
    esac
done

SERVER_MODE=""
if [ "$TARGET" = kg-staging ]
then
    SERVER_MODE="staging"
fi

if [ "$TARGET" = kg-demo ]
then
    SERVER_MODE="demo"
fi

if [ "$TARGET" = kg-prod ]
then
    SERVER_MODE="production"
fi

echo "Rolling back to commit ${GIT_HASH}"
# Rolling back requires us to reset the current environmental variable to use the older hash
# It's important we change the .env file since docker-compose reads the .env file from where it resides for variable substitution
gcloud compute ssh $TARGET --zone us-central1-a --command="sudo sed -i 's/^GITHUB_HASH.*$/GITHUB_HASH=${GIT_HASH}/' /srv/.env && \
    sudo /srv/startup.sh -t $SERVER_MODE -h $GIT_HASH"

