#!/bin/sh

cd /srv
export $(cat staging.env | xargs)
sudo docker login -u $DOCKER_USER -p "$(cat keyfile.json)" https://gcr.io
sudo docker pull gcr.io/$PROJECT_ID/kg-appserver-staging:latest
sudo docker pull gcr.io/$PROJECT_ID/kg-webserver-staging:latest
sudo gsutil cp gs://kg-secrets/docker-compose.ci.yml docker-compose.ci.yml
sudo docker-compose -f docker-compose.ci.yml up -d
