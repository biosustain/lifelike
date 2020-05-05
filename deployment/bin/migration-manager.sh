#!/bin/sh

# Sets permission for CloudSQL to Cloud Bucket Storage
CLOUD_SQL_SERVICE_ACCOUNT=$(sudo gcloud sql instances describe --format="value(serviceAccountEmailAddress)" $CLOUD_SQL_ALIAS)

# Grants access to the Cloud Bucket Storage
sudo gsutil acl ch -u $CLOUD_SQL_SERVICE_ACCOUNT:W gs://$GCE_BACKUP_BUCKET

# Generate a backup identifier with time stamp
BACKUP_ID=${CLOUD_SQL_ALIAS}_\$(date +%Y%m%d_%H-%M-%S).sqldump.gz

# Export the backup to Cloud Bucket Storage
sudo gcloud sql export sql $CLOUD_SQL_ALIAS gs://$GCE_BACKUP_BUCKET/$BACKUP_ID

# Run the migration
if [ "$GCE_INSTANCE" = "kg-staging"]; then
    sudo docker-compose -f docker-compose.ci.yml exec appserver bin/migrate-db --upgrade
fi

if [ "$GCE_INSTANCE" = "kg-prod"]; then
    sudo docker-compose -f docker-compose.prod.yml exec appserver bin/migrate-db --upgrade
fi
