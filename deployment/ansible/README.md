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

## Ansible Cheat Sheet
- Get the GCE instances accessible through Ansible
```bash
ansible-inventory --graph -i inventories/webservers_gcp.yml
```

- Install Docker and Docker Compose Dependency
```bash
ansible-playbook -i inventories/hosts -l sandbox playbooks/docker-install.yml
```
*This particular snippet only installs dependencies on a single server, 'sandbox'*

- Spin up a single VM application environment
```bash
ansible-playbook -i environments/dev --vault-password-file=.vault_secrets_pw playbooks/single_vm_setup.yml -e "github_branch=reduce-docker-size"
```
*This will access the VM specified in 'dev' and clone the GitHub branch 'reduce-docker-size'*

- Spin up ELK stack for production
1. Fetch the vault secrets from google bucket (TODO: add here) `.vault_secrets_pw`
2. Run the following command
```bash
ansible-playbook -i inventories --vault-password-file=.vault_secrets_pw playbooks/elk_setup.yml
```
*This will create the infrastructure for ELK with a Kibana dashboard accessible via https://elk.prod.lifelike.bio*
