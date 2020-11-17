APPSERVER_PATH=./appserver
ANSIBLE_PATH=./deployment/ansible
LMDB_PATH = $(APPSERVER_PATH)/neo4japp/services/annotations/lmdb
PROJECT_ID=able-goods-221820
PROJECT_ID_BACKUP=project_id.backup

# Set gcloud project
set-gcloud:
	gcloud config get-value project > $(PROJECT_ID_BACKUP)
	gcloud config set project $(PROJECT_ID)

# Restore gcloud setting
reset-gcloud:
	cat $(PROJECT_ID_BACKUP) | xargs gcloud config set project

# Fetches the password to unlock Ansible vault files
ansible-secrets:
	gsutil cp gs://kg-secrets/.vault_secrets_pw $(ANSIBLE_PATH)

# Fetches the Google Service account necessary for interacting with GCP services
gcp-sa:
	gsutil cp gs://kg-secrets/ansible_service_account.json $(APPSERVER_PATH)

# Fetches the LMDB files needed to run the application
lmdb:
	gsutil cp -r gs://lmdb_database/chemicals $(LMDB_PATH)
	gsutil cp -r gs://lmdb_database/compounds $(LMDB_PATH)
	gsutil cp -r gs://lmdb_database/diseases $(LMDB_PATH)
	gsutil cp -r gs://lmdb_database/genes $(LMDB_PATH)
	gsutil cp -r gs://lmdb_database/phenotypes $(LMDB_PATH)
	gsutil cp -r gs://lmdb_database/proteins $(LMDB_PATH)
	gsutil cp -r gs://lmdb_database/species $(LMDB_PATH)
	gsutil cp -r gs://lmdb_database/anatomy $(LMDB_PATH)
	gsutil cp -r gs://lmdb_database/foods $(LMDB_PATH)
	find $(LMDB_PATH) -name '*.mdb.backup' -delete

# Sets up everything you need to run the application
# Mostly used for first time dev environment setup
init: set-gcloud ansible-secrets gcp-sa lmdb reset-gcloud
	docker-compose build --no-cache

docker-run: docker-stop set-gcloud gcp-sa reset-gcloud
	export DOCKER_CLIENT_TIMEOUT=300
	export COMPOSE_HTTP_TIMEOUT=300
	docker-compose up -d

docker-stop:
	docker-compose down

clean-pyc:
	find . -name '*.pyc' -delete

clean-docker:
	docker system prune -a --volumes --filter app=kg-prototypes

clean: clean-docker clean-pyc
	# Remove service account for Google Cloud
	find . -name 'ansible_service_account.json' -delete
	# Remove Ansible vault secrets
	find . -name '.vault_secrets_pw' -delete
	# Remove project_id backup
	rm -f $(PROJECT_ID_BACKUP)
