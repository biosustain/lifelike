# User Manual

## Quick Start
1. Run the `makefile` to setup the dependencies
```bash
make venv
```
2. Activate the new virtual environment
```
source venv/bin/activate
```

3. Setup SSH on the servers you want to run Ansible on.
You can do this
-- 1. Going to the Google Compute Engine page
-- 2. Create a SSH key
-- 3. Copy said SSH key
(on a Mac, you can do `cat ~/.ssh/yourkey | pbcopy` to copy the key to the clipboard)
-- 4. Add it to the server and save

## Ansible Cheat Sheet

### What can I do with ansible?
1. Install Docker and Docker Compose Dependency
Description: TODO

2. Spin up a single VM application environment
Description: TODO

### What is Ansible vault and how do I use it?
Ansible vault is used for encrypting/decrypting secrets which will be used during execution. Before using, download the secret credentials from our Google Cloud Bucket (TODO: add here).

1. To view a vault secret, use
```bash
ansible-vault edit <file-name>
```
Enter the password that's found in the `.vault_secrets_pw` file

For more on the usage, please refer to the documentation:
https://docs.ansible.com/ansible/latest/user_guide/vault.html


# Playbooks

## Elastic Stack (Elastic, Logstash, Kibana, Beats)
The following playbook will set up the ELK stack at a specified location. By default, the original playbook will attempt to set up a SSL/TLS secure Kibana, but this can be disabled by individually running each *role* separately; you may want to do this if you're trying to deploy a development environment.

### ELK (Elastic, Kibana, Logstash)

__Usage 1__
1. Fetch the vault secrets from google bucket (TODO: add here) `.vault_secrets_pw`
2. Run the following command
```bash
ansible-playbook -i inventories --vault-password-file=.vault_secrets_pw playbooks/elk_setup.yml
```
This will create the infrastructure for ELK with a Kibana dashboard accessible via https://elk.prod.***ARANGO_DB_NAME***.bio

__Usage 2__
Deploy the elasticsearch role only
```bash
ansible-playbook -i inventories --vault-password-file=.vault_secrets_pw playbooks/elk_setup.yml --tags elasticsearch
```

__Usage 3__
Deploy to a different host besides production
```bash
ansible-playbook -i inventories --vault-password-file=.vault_secrets_pw playbooks/elk_setup.yml --tags nginx --extra-vars "elkhost=sandbox"
```

### Beats (Filebeats, Metricbeats, etc)

Filebeat is used to send logs to the ELK stack. For example, if we had a VM with our application server, Filebeat would be installed along side and will forward any logs to the VM that contains the ELK stack.

__Usage 1__
Deploy Filebeat to production
```bash
ansible-playbook -i inventories --vault-password-file=.vault_secrets_pw playbooks/filebeat_setup.yml --extra-vars "webserver=prod"
```