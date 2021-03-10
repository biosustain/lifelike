APPSERVER_PATH=./appserver
ANSIBLE_PATH=./deployment/ansible
LMDB_PATH = $(APPSERVER_PATH)/neo4japp/services/annotations/lmdb

# Fetches the password to unlock Ansible vault files
ansible-secrets:
	az storage blob download --account-name ***ARANGO_DB_NAME*** --container-name ***ARANGO_DB_NAME***-secrets --name .vault_secrets_pw  --file $(ANSIBLE_PATH)/.vault_secrets_pw

# Fetches the credentials (env file) for Azure services
azure-secrets:
	az storage blob download --account-name ***ARANGO_DB_NAME*** --container-name ***ARANGO_DB_NAME***-secrets --name azure-secrets.env --file ./azure-secrets.env

# Log into azure container registry
container-login:
	az acr login --name ***ARANGO_DB_NAME***

# Fetches the LMDB files needed to run the application
lmdb:
	docker-compose up -d appserver
	docker-compose exec appserver flask load-lmdb
	find $(LMDB_PATH) -name '*.mdb.backup' -delete

# Sets up everything you need to run the application
# Mostly used for first time dev environment setup
init: ansible-secrets azure-secrets lmdb docker-build container-login

docker-build:
	docker-compose build

# Runs enough containers for the application to function
docker-run: docker-stop container-login azure-secrets lmdb
	docker-compose up -d

# Runs additional containers such as Kibana/Logstash/Filebeat
docker-run-all: docker-stop container-login azure-secrets lmdb
	docker-compose -f docker-compose.override.yml -f docker-compose.middleware.yml

docker-stop:
	docker ps -aq | xargs docker stop
	docker ps -aq | xargs docker rm

docker-flask-seed:
	docker-compose exec appserver flask seed

clean-postgres:
	# Quick command to drop the data in localhost postgres database
	# Usually used to seed database from cloud backups
	docker-compose exec pgdatabase psql -U postgres -h pgdatabase -d postgres -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

clean-pyc:
	find . -name '*.pyc' -delete

clean-docker:
	docker system prune -a --volumes

clean: clean-docker clean-pyc
	# Remove service account for Google Cloud
	find . -name 'ansible_service_account.json' -delete
	# Remove Ansible vault secrets
	find . -name '.vault_secrets_pw' -delete
