#!/bin/sh

# ###################################################
# Script is used for downloading the latest LMDB databases from
# Google Cloud Storage Bucket and indexing the data into an
# Elasticsearch service. The data can then be viewed in Kibana.
#
# TODO: Convert this into an Ansible playbook
# ###################################################
# Requires the following
# -- the system needs virtual environment for Python
# -- the system needs access to google cloud CLI (https://cloud.google.com/sdk)
# ####################################################

gsutil cp gs://kg-secrets/ansible_service_account.json .
gsutil cp gs://kg-secrets/servers.json .
SCRIPT_PATH="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export GOOGLE_APPLICATION_CREDENTIALS="${SCRIPT_PATH}/ansible_service_account.json"

virtualenv venv
source ./venv/bin/activate
pip install -r requirements.txt

echo "Downloading & Uploading LMDB data"
python lmdb-download.py && python lmdb-kibana.py lmdb

echo "TIP: Quickly clean up secrets via 'make clean'"