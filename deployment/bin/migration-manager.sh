#!/bin/sh

print_usage() {
    echo "
    ================================= USAGE =================================
    Used for applying database migrations for PostgreSQL using Alembic

    -t          <target: either staging or production or demo>

    e.g. ->
        ./migration-manager.sh -t staging
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

if [ "$TARGET" = staging ]; then
    cd /srv
    export $(cat staging.env | xargs)
fi

if [ "$TARGET" = production ]; then
    cd /srv
    export $(cat prod.env | xargs)
fi

if [ "$TARGET" = demo ]; then
    cd /srv
    export $(cat demo.env | xargs)
fi

# Sets permission for CloudSQL to Cloud Bucket Storage
CLOUD_SQL_SERVICE_ACCOUNT=$(sudo gcloud sql instances describe --format="value(serviceAccountEmailAddress)" $CLOUD_SQL_ALIAS)

# Grants access to the Cloud Bucket Storage
sudo gsutil acl ch -u $CLOUD_SQL_SERVICE_ACCOUNT:W gs://$GCE_BACKUP_BUCKET

# Generate a backup identifier with time stamp
BACKUP_ID=${CLOUD_SQL_ALIAS}_$(date +%Y%m%d_%H-%M-%S).sqldump.gz

# Export the backup to Cloud Bucket Storage
sudo gcloud sql export sql $CLOUD_SQL_ALIAS gs://$GCE_BACKUP_BUCKET/$BACKUP_ID --database=$POSTGRES_DB

# Run the migration
if [ "$TARGET" = staging ]; then
    sudo docker-compose -f docker-compose.ci.yml exec -T appserver bin/migrate-db --upgrade
fi

if [ "$TARGET" = production ]; then
    sudo docker-compose -f docker-compose.prod.yml exec -T appserver bin/migrate-db --upgrade
fi
