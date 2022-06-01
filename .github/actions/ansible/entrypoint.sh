#!/bin/bash
set -e

# helper
tilde=~

# ----------------------------------------------------------------------------
# SSH key path
# ----------------------------------------------------------------------------
mkdir -p ~/.ssh
echo "$INPUT_SSH_KEY" > ~/.ssh/ansible
chmod 0600 ~/.ssh/ansible
export SSH_KEY_FILE_PATH="${tilde}/.ssh/ansible"

# ----------------------------------------------------------------------------
# Ansible Vault password file
# ----------------------------------------------------------------------------
echo "$INPUT_VAULT_PASSWORD" > ~/.vault_secrets_pw
export VAULT_PASSWORD_FILE_PATH="${tilde}/.vault_secrets_pw"

# ----------------------------------------------------------------------------
# Options
# ----------------------------------------------------------------------------
export OPTIONS=$(echo "${INPUT_OPTIONS}" | tr "\n" " ")

# ----------------------------------------------------------------------------
# Authenticate to GCP
# ----------------------------------------------------------------------------
echo "${INPUT_GCP_CREDENTIALS}" > gcp-credentials.json
gcloud auth activate-service-account --key-file=gcp-credentials.json

export GCP_PROJECT_ID=$(jq -r '.project_id' gcp-credentials.json)
gcloud config set project $GCP_PROJECT_ID

# ----------------------------------------------------------------------------
# Run ansible playbook
# ----------------------------------------------------------------------------
echo "Running ansible-playbook command..."
cd ${INPUT_WORKSPACE_DIR}
ansible-playbook \
  ${INPUT_PLAYBOOK_FILE_PATH} \
  -i ${INPUT_INVENTORY_FILE_PATH} \
  --key-file ${SSH_KEY_FILE_PATH} \
  --vault-password-file ${VAULT_PASSWORD_FILE_PATH} \
  $OPTIONS
