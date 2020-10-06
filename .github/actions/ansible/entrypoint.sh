#!/bin/sh

set -e

export WORKSPACE_DIR=
if [ ! -z "$INPUT_WORKSPACE_DIR" ]
then
    WORKSPACE_DIR="${INPUT_WORKSPACE_DIR}"
else
    echo "No working space directory specified."
fi

export PLAYBOOK_FILE_PATH=
if [ ! -z "$INPUT_PLAYBOOK_FILE_PATH" ]
then
    PLAYBOOK_FILE_PATH="${INPUT_PLAYBOOK_FILE_PATH}"
else
    echo "No playbook specified."
fi

export INVENTORY_FILE_PATH=
if [ ! -z "$INPUT_INVENTORY_FILE_PATH" ]
then
    INVENTORY_FILE_PATH="-i ${INPUT_INVENTORY_FILE_PATH}"
else
    echo "No inventory specified."
fi

export SSH_KEY=
if [ ! -z "$INPUT_SSH_KEY" ]
then
    mkdir ~/.ssh
    echo "$INPUT_SSH_KEY" > ~/.ssh/ansible
    chmod 0600 ~/.ssh/ansible
    tilde=~
    SSH_KEY_PATH="${tilde}/.ssh/ansible"
    SSH_KEY="--key-file ${SSH_KEY_PATH}"
else
    echo "No SSH key specified."
fi

export VAULT_PASSWORD=
if [ ! -z "$INPUT_VAULT_PASSWORD" ]
then
    echo "$INPUT_VAULT_PASSWORD" > ~/.vault_secrets_pw
    tilde=~
    VAULT_PASSWORD_PATH="${tilde}/.vault_secrets_pw"
    VAULT_PASSWORD="--vault-password-file ${VAULT_PASSWORD_PATH}"
else
    echo "No vault password specified."
fi

export OPTIONS=
if [ ! -z "$INPUT_OPTIONS" ]
then
    OPTIONS=$(echo "${INPUT_OPTIONS}" | tr "\n" " ")
fi

cd ${WORKSPACE_DIR}
echo "Running command..."
echo ansible-playbook ${PLAYBOOK_FILE_PATH} ${INVENTORY_FILE_PATH} ${SSH_KEY} ${VAULT_PASSWORD} ${OPTIONS}
ansible-playbook ${PLAYBOOK_FILE_PATH} ${INVENTORY_FILE_PATH} ${SSH_KEY} ${VAULT_PASSWORD} ${OPTIONS}
