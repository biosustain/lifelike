#!/bin/sh

# sudo apt-get update \
#     && sudo apt-get install docker-compose -y

sudo gsutil cp -r gs://lmdb_database/chemicals /mnt/disks/kg-kibana-annotations/lmdb
sudo gsutil cp -r gs://lmdb_database/compounds /mnt/disks/kg-kibana-annotations/lmdb
sudo gsutil cp -r gs://lmdb_database/diseases /mnt/disks/kg-kibana-annotations/lmdb
sudo gsutil cp -r gs://lmdb_database/genes /mnt/disks/kg-kibana-annotations/lmdb
sudo gsutil cp -r gs://lmdb_database/phenotypes /mnt/disks/kg-kibana-annotations/lmdb
sudo gsutil cp -r gs://lmdb_database/proteins /mnt/disks/kg-kibana-annotations/lmdb
sudo gsutil cp -r gs://lmdb_database/species /mnt/disks/kg-kibana-annotations/lmdb

sudo gsutil cp -r gs://lmdb_database/index_annotations.py /mnt/disks/kg-kibana-annotations/

sudo docker-compose -f docker-compose.kibana.yml up -d

python /mnt/disks/kg-kibana-annotations/index_annotations.py -a
