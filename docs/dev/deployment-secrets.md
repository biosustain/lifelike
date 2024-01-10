# Github Action Secrets

This file documents usage and process of recreating github action secrets needed to run our pipelines

## `ACTION_TOKEN`

This is github private access token. It is ussed in place of GITHUB_TOKEN in order to rerun workflows after fixing code style (if we use GITHUB_TOKEN to commit workflows are dissabled).

### Creation

[Create a personal access token](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token)

Scopes:
admin:enterprise, admin:gpg_key, admin:org, admin:org_hook, admin:public_key, admin:repo_hook, admin:ssh_signing_key, audit_log, codespace, copilot, delete:packages, delete_repo, gist, notifications, project, repo, user, workflow, write:discussion, write:packages

## `ANSIBLE_PRIVATE_SSH_KEY`

<!-- TODO: Why we need it? -->

Note: Public part of this key seems to be denoted here: https://portal.azure.com/#@dtudk.onmicrosoft.com/resource/subscriptions/747d6a13-5882-4572-8560-af80d7df69b5/resourceGroups/lifelike-ecosystem/providers/Microsoft.Compute/sshPublicKeys/ansible/overview

### Fetching

It can be downloaded from https://storage.cloud.google.com/kg-secrets/ansible

### Creation

Simple ssh `keygen`.

## `ANSIBLE_SERVICE_ACCOUNT`

Depreciated.

This is a service account used to authenticate with google cloud. Curently it carries credentials to: ansible@able-goods-221820.iam.gserviceaccount.com (https://console.cloud.google.com/iam-admin/iam?referrer=search&authuser=0&project=able-goods-221820).

### Fetching

This credentials can be fetched from google cloud kublet: `gsutil cp gs://kg-secrets/ansible_service_account.json ./appserver`.

### Creation

Create a google service account and downloading its credentials as json file.
https://cloud.google.com/iam/docs/service-accounts-create

Service account scopes:

-   Cloud SQL Admin
-   Compute Admin
-   Compute Storage Admin
-   Container Registry Service Agent
-   Pub/Sub Editor
-   Secret Manager Admin
-   Storage Admin
-   Storage Object Admin
-   Storage Object Viewer
-   Storage Transfer Admin

## `ANSIBLE_VAULT`

Password for ansible vault. This is used to encrypt sensitive data in ansible playbooks.
This is the password used to encrypt ansible vault in here: https://github.com/SBRG/lifelike-infra/tree/859bae595a46d50dd6c22e785d7cc9dcb10d64a6/ansible/inventories/group_vars

### Fetching

After creation of vault it has been deposited as azure storage blob and can be fetched by running `make ansible-secrets` (`az storage blob download --account-name lifelike --container-name lifelike-secrets --name .vault_secrets_pw  --file $(ANSIBLE_PATH)/.vault_secrets_pw --auth-mode login`).

### Creation

Password used to encrypt ansible vault.

## `AZURE_CR_USERNAME` & `AZURE_CR_PASSWORD`

Azure container registry username password. This is used to push docker images to azure container registry.

### Creation

Create a service account and assign it a contributor role in the container registry.
https://portal.azure.com/#@dtudk.onmicrosoft.com/resource/subscriptions/747d6a13-5882-4572-8560-af80d7df69b5/resourceGroups/lifelike-ecosystem/providers/Microsoft.ContainerRegistry/registries/lifelike/users

## `AZURE_SERVICE_CREDENTIALS`

Depreciated.

## `DEMO_POSTGRES_HOST`

Depreciated.

## `DEMO_POSTGRES_PORT`

Depreciated.

## `DEMO_POSTGRES_USER`

Depreciated.

## `ELASTICSEARCH_HOSTS`

Adress/adresses of elasticsearch in format `http://<ip>:<port>` or ["http://<ip>:<port>", "http://<ip>:<port>"].
Depreciated in github actions pipelines.

## `GCE_BACKUP_BUCKET`

Depreciated.

## `GCE_PROJECT`

Depreciated.

## `GCE_SA_KEY`

Google cloud service account credentials. This is used to authenticate with google cloud to for instance interface with hosted SQL database.

### Creation

Create a service account and assign it roles (https://console.cloud.google.com/iam-admin/iam?project=able-goods-221820):

-   Option 1:
    -   Compute Admin
    -   Compute Network Admin
-   Option 2:
    -   Cloud KMS CryptoKey Encrypter/Decrypter
    -   Cloud SQL Admin
    -   Compute Instance Admin (v1)
    -   Service Account User
    -   Storage Admin

<!-- TODO: check which option is correct -->

## `GCP_PRIVATE_SSH_KEY`

Depreciated.

## `GHUB_PAT`

Depreciated.

## `GHUB_TOKEN`

Depreciated.

## `INFRA_PAT`

This is github private access token. It is ussed in place of GITHUB_TOKEN in order to be able to checkout submodules.

### Creation

[Create a personal access token](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token)

Required scopes:

-   read:\< all nested reppositories \>

<!-- TODO: Check needed scopes -->

## `KUBE_CONFIG`

Depreciated.

## `NEO4J_ENTITIES_HOST`

Depreciated.

## `NEO4J_ENTITIES_PASS`

Depreciated.

## `NEO4J_ENTITIES_USER`

Depreciated.

## `POSTGRES_BACKUP_BUCKET`

Depreciated.

## `PROD_CLOUD_SQL_ALIAS`

Depreciated.

## `PROD_FLASK_APP`

Depreciated.

## `PROD_FLASK_APP_CONFIG`

Depreciated.

## `PROD_FLASK_ENV`

Depreciated.

## `PROD_NEO4J_AUTH`

Depreciated.

## `PROD_NEO4J_HOST`

Depreciated.

## `PROD_POSTGRES_DB`

Depreciated.

## `PROD_POSTGRES_HOST`

Depreciated.

## `PROD_POSTGRES_PASSWORD`

Depreciated.

## `PROD_POSTGRES_PORT`

Depreciated.

## `PROD_POSTGRES_USER`

Depreciated.

## `REDIS_HOST`

Depreciated.

## `REDIS_PORT`

Depreciated.

## `SENTRY_KEY`

Depreciated.

## `STAGING_CLOUD_SQL_ALIAS`

Depreciated.

## `STAGING_FLASK_APP`

Depreciated.

## `STAGING_FLASK_APP_CONFIG`

Depreciated.

## `STAGING_FLASK_ENV`

Depreciated.

## `STAGING_NEO4J_AUTH`

Depreciated.

## `STAGING_NEO4J_HOST`

Depreciated.

## `STAGING_POSTGRES_DB`

Depreciated.

## `STAGING_POSTGRES_HOST`

Depreciated.

## `STAGING_POSTGRES_PASSWORD`

Depreciated.

## `STAGING_POSTGRES_PORT`

Depreciated.

## `STAGING_POSTGRES_USER`

Depreciated.

## `SBRG_MACHINE_DOCKERHUB_TOKEN`

Depreciated.

## `SBRG_MACHINE_DOCKERHUB_USERNAME`

Depreciated.

## `SBRG_MACHINE_GHCR_TOKEN`

Depreciated.

## `SBRG_MACHINE_GHCR_USERNAME`

Depreciated.

## `SBRG_MACHINE_PYPI_TEST_TOKEN`

Depreciated.

## `SBRG_MACHINE_PYPI_TOKEN`

Depreciated.

## `SBRG_MACHINE_PYPI_USERNAME`

Depreciated.
