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
*This particular snippet only installs dependencies on a single server, 'sandbox'*
```bash
ansible-playbook -i inventories/hosts -l sandbox playbooks/docker-install.yml
```
