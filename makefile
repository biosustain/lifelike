APPSERVER_PATH=./appserver
ANSIBLE_PATH=./deployment/ansible
LMDB_PATH = $(APPSERVER_PATH)/neo4japp/services/annotations/lmdb

# Fetches the password to unlock Ansible vault files
ansible-secrets:
	gsutil cp gs://kg-secrets/.vault_secrets_pw $(ANSIBLE_PATH)

# Fetches the Google Service account necessary for interacting with GCP services
gcp-sa:
	gsutil cp gs://kg-secrets/ansible_service_account.json $(APPSERVER_PATH)

# Fetches the LMDB files needed to run the application
lmdb:
	docker-compose up -d appserver
	docker-compose exec appserver flask load-lmdb
	find $(LMDB_PATH) -name '*.mdb.backup' -delete

# Sets up everything you need to run the application
# Mostly used for first time dev environment setup
init: ansible-secrets gcp-sa
	docker-compose build --no-cache

docker-run: docker-stop gcp-sa lmdb
	docker-compose up -d

docker-stop:
	docker-compose down

clean-pyc:
	find . -name '*.pyc' -delete

clean-docker:
	docker system prune -a --volumes

clean: clean-docker clean-pyc
	# Remove service account for Google Cloud
	find . -name 'ansible_service_account.json' -delete
	# Remove Ansible vault secrets
	find . -name '.vault_secrets_pw' -delete
