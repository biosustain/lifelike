#!/bin/sh

# sudo curl -L "https://github.com/docker/compose/releases/download/1.26.2/docker-compose-$(uname -s)-$(uname -m)" -o \
    # /usr/local/bin/docker-compose
# sudo chmod +x /usr/local/bin/docker-compose

cd /srv
sudo mkdir lmdb

sudo gsutil cp -r gs://lmdb_database/chemicals /srv/lmdb/
sudo gsutil cp -r gs://lmdb_database/compounds /srv/lmdb/
sudo gsutil cp -r gs://lmdb_database/diseases /srv/lmdb/
sudo gsutil cp -r gs://lmdb_database/genes /srv/lmdb/
sudo gsutil cp -r gs://lmdb_database/phenotypes /srv/lmdb/
sudo gsutil cp -r gs://lmdb_database/proteins /srv/lmdb/
sudo gsutil cp -r gs://lmdb_database/species /srv/lmdb/

sudo gsutil cp -r gs://lmdb_database/index_annotations.py /srv/lmdb/

sudo docker-compose -f docker-compose.kibana.yml up -d

python /srv/lmdb/index_annotations.py -a
