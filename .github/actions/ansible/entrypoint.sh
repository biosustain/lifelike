echo "$ANSIBLE_VAULT" > ~/.vault_secrets_pw
mkdir ~/.ssh
echo "$ANSIBLE_PRIVATE_SSH_KEY" > ~/.ssh/id_rsa
chmod 0600 ~/.ssh/id_rsa

export ANSIBLE_CONFIG="deployment/ansible/ansible.cfg"
ansible-playbook -i deployment/ansible/inventories/hosts \
                 --vault-password-file ~/.vault_secrets_pw \
                 --extra-vars "webservers=$DEPLOY_ENV docker_image_hash=$DOCKER_IMG_HASH git_timestamp=$GIT_TIMESTAMP" \
                deployment/ansible/playbooks/deploy.yml