# Deploying the Application

## Deployment to Gloud for Lifelike
---

## Table of Contents
- [How do I set up the infrastructure](#how-do-i-set-up-the-infrastructure)

- [How do I deploy the application?](#how-do-i-deploy-the-application)

- [How do I update the Nginx configuration?](#how-do-i-update-the-nginx-configuration)

# How do I set up the infrastructure?

Creation of servers and databases are done through Terraform. This does not include deployment of the server application nor the client bundle. We do those in another step.

Terraform Docs:
- https://www.terraform.io/docs/provisioners/index.html
- https://www.terraform.io/docs/providers/google/index.html
- https://www.terraform.io/docs/modules/index.html

1. Download and install Terraform
   - https://www.terraform.io/downloads.html
   - Test the installation was done correctly by running `terraform --version`

2. Get the **Terraform service account key file** from Google Cloud Reconstruction project.

To navigate there
- Go to Google Cloud project Reconstruction
- Go to **IAM & Admin** > **Service Accounts**
- Select **terraform**
- Select **create key** and rename this file to `terraform-gcloud.json` to the `appserver/terraform` folder.
*This file should not be comitted and `.gitignore` ignores it*

3. Install Google Cloud CLI
- On MacOS, try `brew cask install google-cloud-sdk`. Be sure to install the cloud_sql_proxy as well by running the command `gcloud components install cloud_sql_proxy`.

4. (Optional) Add ssh key to keychain (MacOS)
- If you are regularly seeing requests for your ssh key passcode (i.e. `Enter passphrase for key '/Users/.../.ssh/google_compute_engine.`), then try adding it to the MacOS keychain via `sudo ssh-add -k ~/.ssh/google_compute_engine`

5. Log into Google Cloud via Command Line
```
gcloud beta auth revoke --all # Logout of any active accounts
gcloud beta auth login # Log into Reconstruction (you will have to use your account credentials)
gcloud beta config set project able-goods-221820 # Set the current project
```

6. Deployment of the Compute Engine Instances and Cloud SQL using Terraform

The Terraform will create the following infrastructure
- A VM for a nginx proxy
  - The initialization step will use Docker to create a SSL/TLS enabled nginx proxy. As of this update, all variables are currently hardcoded so this proxy will be to https://kg.***ARANGO_DB_NAME***.bio
- A VM for an application server (Flask)
- A VM for a test Neo4j instance
  - The initialization step will also update the secret `deploy.env` file to contain the Neo4j VM IP address.
- A managed Cloud SQL (PostgreSQL) instance

7. Run Terraform
-  There is a wrapper script `terraform/run-terraform` which you should run instead of using `terraform` command directly. The reason is because we need to pull/push the `terraform.tfstate` file into a persistent storage and if you don't use the script, you may forget to do that. The script will handle the pulling/pulling of the state file.

# How do I deploy the application?

Currently the deployment is done through shell scripts under the `deployment` directory. There are two scripts
- `deploy-appserver`
  - This script will be used to build the application server, connect to Neo4j and run any necessary migrations to PostgreSQL.
  - Run this using
  ```
    ./deploy-appserver -m <migration flag> -r <fetch flag>
  ```
  - `-m` flag is used for setting the PostgreSQL migration to either `fresh` or `upgrade`. Most of the time, we'd want to use `upgrade` since we'd ideally only want to set up the infrastructure only once and subsequently
  - `-r` flag is used to fetch the latest master for building and deploying; `true` or `false`
- `deploy-client`
  - This script will be used to build the Angular bundle and SCP this into the nginx proxy VM.
  - Run this using
  ```
    ./deploy-client -r <fetch flag>
  ```
  - `-r` flag is used to fetch the latest master for building and deploying; `true` or `false`

# How do I update the Nginx configuration?

The configuration file is volume linked to our Nginx proxy in `/docker/letsencrypt-docker-nginx/src/production` under `production.conf`. Add changes to `nginx.conf` file found in `terraform/gateway-init/production` and use the shell script `update-nginx-conf` within the directory to update it. **Be sure to commit these changes to GitHub.**