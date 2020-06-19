#!/bin/bash

print_usage() {
    echo "
    ================================= USAGE ====================================
    Used for updating LMDB files on server and updating the lmdbs_date db table.

    -a          update all lmdb files
    -n          <name: name of folder lmdb file is in>
    -c          <container id: id of the docker container>

    e.g. ->
        ./fetch-new.sh -n chemicals

    Current list of folders:
        chemicals
        compounds
        diseases
        genes
        phenotypes
        proteins
        species
    ============================================================================
    "
}

set -o errexit                  # exit on command failure; use <cmd> || true to allow for exception
set -o nounset                  # exit when script tries to use undeclared variables

declare -A FOLDERNAMES

FOLDERNAMES[chemicals]=true
FOLDERNAMES[compounds]=true
FOLDERNAMES[diseases]=true
FOLDERNAMES[genes]=true
FOLDERNAMES[phenotypes]=true
FOLDERNAMES[proteins]=true
FOLDERNAMES[species]=true

if [ $# -ne 4 ];
then
    echo "Illegal number of arguments -- you must include the following"
    print_usage && exit 1
fi

CONTAINER=""
TARGET=""

while getopts "an:c:" flag; do
    case "${flag}" in
        a) TARGET="all";;
        n) TARGET="${OPTARG}";;
        c) CONTAINER="${OPTARG}";;
        *) print_usage && exit 1;;
    esac
done

if [ "$TARGET" = "all" ]; then
    sudo gsutil cp -r gs://lmdb_database/chemicals /mnt/disks/kg-staging-persistent/lmdb
    sudo gsutil cp -r gs://lmdb_database/compounds /mnt/disks/kg-staging-persistent/lmdb
    sudo gsutil cp -r gs://lmdb_database/diseases /mnt/disks/kg-staging-persistent/lmdb
    sudo gsutil cp -r gs://lmdb_database/genes /mnt/disks/kg-staging-persistent/lmdb
    sudo gsutil cp -r gs://lmdb_database/phenotype /mnt/disks/kg-staging-persistent/lmdb
    sudo gsutil cp -r gs://lmdb_database/proteins /mnt/disks/kg-staging-persistent/lmdb
    sudo gsutil cp -r gs://lmdb_database/species /mnt/disks/kg-staging-persistent/lmdb

    docker exec ${CONTAINER} python neo4japp/services/annotations/update_lmdb_date_table.py -a
elif [ FOLDERNAMES[${TARGET}] ]; then
    sudo gsutil cp -r gs://lmdb_database/${TARGET} /mnt/disks/kg-staging-persistent/lmdb
    docker exec ${CONTAINER} python neo4japp/services/annotations/update_lmdb_date_table.py -n ${TARGET}
else
    print_usage && exit 1
fi
