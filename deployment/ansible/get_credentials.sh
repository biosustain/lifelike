#!/bin/bash
#
# Lifelike Service Account Credentials
# This service account file is used for authorization
# with GCP services. Do not version control or share
# this file outside of the deployment process
gsutil cp gs://kg-secrets/ansible_service_account.json ansible_service_account.json

# Get other gcloud secrets for gcloud services (e.g. buckets)
gsutil cp gs://kg-secrets/gcloud_ansible_secrets.yml gcloud_ansible_secrets.yml
