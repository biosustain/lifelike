#!/bin/sh

# sudo curl -L "https://github.com/docker/compose/releases/download/1.26.2/docker-compose-$(uname -s)-$(uname -m)" -o \
    # /usr/local/bin/docker-compose
# sudo chmod +x /usr/local/bin/docker-compose

cd /srv
sudo mkdir lmdb

sudo apt-get update && sudo apt-get install python3-pip -y

# set python
RUN echo 'alias python=python3' >> ~/.bashrc && \
    echo 'alias pip=pip3' >> ~/.bashrc && \
    source ~/.bashrc

pip install elasticsearch==7.6.0

sudo gsutil cp -r gs://lmdb_database/chemicals /srv/lmdb/
sudo gsutil cp -r gs://lmdb_database/compounds /srv/lmdb/
sudo gsutil cp -r gs://lmdb_database/diseases /srv/lmdb/
sudo gsutil cp -r gs://lmdb_database/genes /srv/lmdb/
sudo gsutil cp -r gs://lmdb_database/phenotypes /srv/lmdb/
sudo gsutil cp -r gs://lmdb_database/proteins /srv/lmdb/
sudo gsutil cp -r gs://lmdb_database/species /srv/lmdb/

sudo docker login -u $DOCKER_USER -p "$(cat keyfile.json)" https://gcr.io
sudo docker pull gcr.io/$PROJECT_ID/kg-appserver-staging:latest

sudo docker-compose -f docker-compose.kibana.yml up -d

sudo docker-compose -f docker-compose.kibana.yml exec appserver python neo4japp/services/annotations/index_annotations.py -a
