gcloud-setup:
	gcloud init
	gcloud auth login
	gcloud config set project able-goods-221820

# Fetches the LMDB files needed to run the application
lmdb: gcloud-setup
	gsutil cp gs://lmdb/lmdb_v6.tgz  .
	tar zxvf lmdb_v6.tgz

# Sets up commit hooks for linting
githooks:
	git config --local core.hooksPath .githooks/

stop:
	docker-compose down --volumes

reset-db:

docker-flask-seed:
	pipenv run flask
