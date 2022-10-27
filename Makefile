.PHONY: lmdb-fetch up down githooks gcloud-setup


# Fetch LMDB database files
source?=gs://lmdb/v6
target?=appserver/neo4japp/services/annotations/lmdb
lmdb-fetch:
	gsutil -m rsync -r ${source} ${target}


# Bring up Docker Compose services
profile?=service,app
args?=-d
up:
	docker compose --profile ${profile} up ${args}


# Bring down Docker Compose services
down:
	docker compose down --volumes --remove-orphans


# Sets up commit hooks for linting
githooks:
	git config --local core.hooksPath .githooks/


# Set up Google Cloud Platform SDK
gcp_project_id=able-goods-221820
gcloud-setup:
	@echo "Google Cloud Platform setup..."	
	gcloud auth login
	gcloud config set project ${gcp_project_id}
