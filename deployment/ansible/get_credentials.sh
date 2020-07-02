#!/bin/bash
#
# Lifelike Service Account Credentials
# This service account file is used for authorization
# with GCP services. Do not version control or share
# this file outside of the deployment process
gsutil cp gs://kg-secrets/ansible_service_account.json ansible_service_account.json