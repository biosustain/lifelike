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

echo "Rolling back to commit ${GIT_HASH}"

gcloud compute ssh $TARGET --zone us-central1-a --command="sudo /srv/startup.sh -t $TARGET -h $GIT_HASH";

