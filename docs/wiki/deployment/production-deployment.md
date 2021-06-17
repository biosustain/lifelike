# Table of contents
- [Table of contents](#table-of-contents)
- [Initial Requirements](#initial-requirements)
- [Quickstart](#quickstart)
  - [QA Deployment](#qa-deployment)
  - [Staging Deployment](#staging-deployment)
  - [Production Deployment](#production-deployment)
- [Overview](#overview)
  - [Infrastructure Environment Setup](#infrastructure-environment-setup)
  - [Local Environment Setup](#local-environment-setup)
  - [GitHub Environment Setup](#github-environment-setup)
- [From Zero](#from-zero)
  - [Phase 1 - Infrastructure Environment Setup](#phase-1---infrastructure-environment-setup)
    - [Application (API) Service Setup](#application-api-service-setup)
    - [Cloud SQL Setup](#cloud-sql-setup)
  - [Phase 2 - Local Environment Setup](#phase-2---local-environment-setup)
    - [1. Environment Setup](#1-environment-setup)
    - [2. Playbooks & Roles](#2-playbooks--roles)
    - [3. Deploying A Brand New Environment](#3-deploying-a-brand-new-environment)
    - [Phase 3 - GitHub Environment Setup](#phase-3---github-environment-setup)

# Initial Requirements
1. Google Cloud Project Access
2. Google Cloud CLI SDK (https://cloud.google.com/sdk)

__Other__

3. Namecheap DNS account access
```bash
gsutil cp gs://kg-secrets/***ARANGO_DB_NAME***-accounts.txt .
```
4. Superuser for ***ARANGO_DB_NAME***.bio
```bash
gsutil cp gs://kg-secrets/***ARANGO_DB_NAME***-accounts.txt .
```

# Quickstart

If you're in a hurry and just need to know how to deploy various stages of the application, start here.

## QA Deployment

__Manual Trigger Method__
1. Go to the [GitHub Actions](https://github.com/SBRG/kg-prototypes/actions) page
2. Go to one of the GCP deployment workflows. [See Example](https://github.com/SBRG/kg-prototypes/actions/workflows/staging-gcloud.yml)
3. If the workflow has the trigger, you should see the message.

   `This workflow has a workflow_dispatch event trigger.`
4. Click **Run Workflow** and choose the branch you want to deploy. NOTE, when selecting a branch, it must have a workflow that contains the trigger `workflow_dispatch`.

__Tag Method__
1. Clone the repository
```bash
git clone https://github.com/SBRG/kg-prototypes.git
```
2. Create a branch from commit you want to build from (or use master)
```bash
git checkout <your-desired-branch>
git checkout -b <new branch>
*The second checkout is optional and just used to ensure we keep the original branch pristine*
```
3. Delete any existing *qa* tag locally
```bash
git tag --delete qa
```
4. Delete any existing *qa* tag remotely
```bash
git tag --delete origin qa
```
5. Tag your new branch
```bash
git tag qa
```
6. Push the tags
```bash
git push origin qa
```
7. Steps 3-6 can be written in a shell script
```bash
#!/bin/bash
git tag --delete qa
git push --delete origin qa
git tag qa
git push origin qa
```
8. View the build progress under **QA Deployment** at https://github.com/SBRG/kg-prototypes/actions

## Staging Deployment

__Manual Trigger Method__
1. Go to the [GitHub Actions](https://github.com/SBRG/kg-prototypes/actions) page
2. Go to one of the GCP deployment workflows. [See Example](https://github.com/SBRG/kg-prototypes/actions/workflows/staging-gcloud.yml)
3. If the workflow has the trigger, you should see the message.

   `This workflow has a workflow_dispatch event trigger.`
4. Click **Run Workflow** and choose the branch you want to deploy. NOTE, when selecting a branch, it must have a workflow that contains the trigger `workflow_dispatch`.

__Tag Method__
Same idea as [QA Deployment](#qa-deployment) but change the tag to **staging**

1. Clone the repository
```bash
git clone https://github.com/SBRG/kg-prototypes.git
```
2. Create a branch from where y
```bash
git checkout <your-desired-branch>
git checkout -b <new branch>
*The second checkout is optional and just used to ensure we keep the original branch pristine*
```
3. Delete any existing *staging* tag locally
```bash
git tag --delete staging
```
4. Delete any existing *staging* tag remotely
```bash
git tag --delete origin staging
```
5. Tag your new branch
```bash
git tag staging
```
6. Push the tags
```bash
git push origin staging
```
7. Steps 3-6 can be written in a shell script
```bash
#!/bin/bash
git tag --delete staging
git push --delete origin staging
git tag staging
git push origin staging
```
8. View the build progress under **Staging Deployment** at https://github.com/SBRG/kg-prototypes/actions


## Production Deployment

Production deployment is a bit different as we use the "release" feature of GitHub.

1. Go to https://github.com/SBRG/kg-prototypes/releases
2. Click **Draft a new release** or go https://github.com/SBRG/kg-prototypes/releases/new
3. In the **Tag version**, enter the version in the semantic we use (x.x.x) (e.g. 0.9.0)
4. Choose **master** as the target
5. Name the release. We're currently using the naming scheme "Lifelike-<version number>" (e.g. Lifelike-0.9.0)
6. Fill in any description about the release such as a change log
7. Click **Publish release** to finalize the deployment
8. View the build progress under **Production Deployment** at https://github.com/SBRG/kg-prototypes/actions

**NOTE:** Production can be deployed using the *tag* or *manual trigger* method, but its discouraged as we won't have an audit trail of the different versions.

# Overview
The deployment process takes place in 3 separate environments; the local computer (Ansible), GitHub (via GitHub actions), and Google Cloud.

## Infrastructure Environment Setup
For any deployments from scratch, we'll need to setup the virtual machine(s), or VM(s) to run the application. We will need
1. A virtual machine for our application server
2. A virtual machine for our cloudsql database (e.g. PostgreSQL Cloud SQL)
3. A Google Cloud Service Account (https://cloud.google.com/iam/docs/service-accounts) that has access to
    - Google Compute Engine (VM)
    - Google Cloud Storage

## Local Environment Setup
We will need to install Ansible locally to be able to run some Ansible playbooks (https://docs.ansible.com/ansible/latest/user_guide/playbooks.html). Ansible is installed using Python pip. It's recommended you use a virtual environment to install Ansible.

Ansible is used for writing reusable and human readable scripts that helps us set up our servers. Some of the functionalities we use Ansible for are
1. Installing server dependencies
2. Installing the ELK stack
3. Deploying our application

## GitHub Environment Setup
GitHub actions is a workflow management system. It allows developers to create sequence of events that occur when its triggered. We use GitHub actions to run our continuous integration (CI) and for continuous delivery (CD) of our application. To learn more about GitHub actions, visit https://docs.github.com/en/free-pro-team@latest/actions

- The **CI** portion runs our unit tests and linting for both the application server and the client
- The **CD** portion builds our Docker images and pushes them into our Google Container Registry which is then followed by a trigger to our Ansible deployment playbook which deploys our application

# From Zero

This portion will do its best to describe all things that need to be considered to deploy from scratch. This includes setting up the virtual machines, the networking, and other miscellaneous tasks for the application.

## Phase 1 - Infrastructure Environment Setup

### Application (API) Service Setup
1. [Initial Requirements](#initial-requirements) must be met before beginning the process
2. Go to the [Google Cloud Dashboard](https://console.cloud.google.com/compute/instances?project=able-goods-221820)
3. Navigate to **Compute** -> **Compute Engine** -> **[VM Instances](https://console.cloud.google.com/compute/instances?project=able-goods-221820&instancessize=50)**
4. Create a new instance
5. Name the instance something memorable
6. Leave the defaults for *Region*, *Zone* which are **us-central1 (Iowa)** and **us-central1-a** respectively
7. Select any machine type that suits the needs of the application(s); in our case, we generally use the E2 Series
8. Select the operating system under *Boot Disk*. We generally use **Ubuntu 18.x LTS** for most of the machines

__Optional__

Steps 9-12 are optional, but suggested as they'll be used with Ansible at a later step. It's optional since you may use your own SSH keys if you wish.

9. Click **Management, security, disks, networking, sole tenancy** to expand the menu
10. Click on the **Security** tab
11. Download the Ansible public key on Google Cloud Storage
```bash
gsutil cp gs://kg-secrets/ansible.pub .
```
12. Copy and paste the key into the *SSH Keys* box
13. You may leave everything else as default
14. Click **create**

__Temporarily Mandatory__
(*Steps 11 - 12*)

11. Navigate to **VPC network** -> **[External IP addresses](https://console.cloud.google.com/networking/addresses/list?project=able-goods-221820)**
*This is temporarily mandatory as we use Ansible to connect to our machines. Ansible has the capabilities to use a Google Cloud plugin to search for machines by their name, but we have not yet set that up. This means we need an ip address that will always refer to our machine*
12. Find the name of the instance from **Step 5** and click **Reserve Static Address**; this will give a permanent ip address to the machine that can be referred to from outside of the cloud platform

### Cloud SQL Setup
1. Go to the [Google Cloud Dashboard](https://console.cloud.google.com/compute/instances?project=able-goods-221820)
2. Navigate to **Databases** -> **[SQL](https://console.cloud.google.com/sql/instances?project=able-goods-221820)**
3. Click **Create Instance**
4. Select a database. We usually use PostgreSQL
5. Choose a memorable database name for the instance
6. Generate a password and remember to store this. We'll need it later for our Ansible scripts
7. Keep the *Region* and *Zone* the same as specified in **Step 6** in **Application (API) Service Setup**
8. Select a database version. We're currently using 11 for most of our PostgreSQL machines
9. You may leave everything else as default
10. Click **create**
11. **(Optional)** Once the instance is created, you can add the virtual machine created during the **Application (API) Service Setup** step to the whitelist to allow it to have access to the database. This is located on the left hand menu item called **Connections**. Click **Add Network** and add the IP address of the virtual machine.

This mostly wraps up our infrastructure deployments. The only other component that wasn't covered is the Elastic stack (ELK). The setup is generally very similar to what can be seen in the **Application (API) Service Setup**. We only deviate from this during the application deployment process with Ansible.

## Phase 2 - Local Environment Setup

The majority of our infrastructure is handled through [Ansible](https://www.ansible.com/) on a local environment. At a later portion of this documentation, we'll discover how we integrate Ansible with [GitHub actions](https://docs.github.com/en/free-pro-team@latest/actions) to create a continuous delivery system that does not rely on us having to kick off builds on a local environment.

### 1. Environment Setup
1. Set up the Ansible environment by installing Ansible via pip pip install ansible
2. Either set up your own SSH keys for Ansible and add it to the Google Compute Engine Instance OR use the existing ones that would have been setup during the optional steps in the **Application (API) Service Setup**

- Private Key
```bash
gsutil cp gs://kg-secrets/ansible .
```
- Public Key
```bash
gsutil cp gs://kg-secrets/ansible.pub .
```
**NOTE:** If you're using an operation system that's not Linux or a variation of it such as OSX, the following steps will have to be revised.

**NOTE:** If you get a permission warning for the files, you'll need to configure the permission levels accordingly. For example, on Linux, you can do
```bash
chmod 600 ansible
```

3. Add the *private* and *public* keys into `~/.ssh/` OR modify the `ansible.cfg` file to another directory of your choice

**ansible.cfg**
```
[defaults]
host_key_checking = False
roles_path = playbooks/roles
inventory = inventories/hosts
remote_user = ansible
private_key_file = **EDIT ME**
interpreter_python = /usr/bin/python3

[inventory]
enable_plugins = host_list, script, yaml, ini, auto, gcp_compute
```
4. Download the *Ansible Vault* secrets file which is needed to decrypt the Ansible encrypted files. 

**Note:** You may place the file anywhere, but its recommended to add it to the top level of the *ansible* directory
```bash
gsutil cp gs://kg-secrets/.vault_secrets_pw .
```

### 2. Playbooks & Roles

Ansible's main components are *Playbooks* and *Roles*. In short, they could be thought of as recipes or steps to perform such as deploying an application. *Roles* can be thought of as a more granular form of a *Playbook* which can be re-used in many other *Playbooks*.

The playbooks we currently have are
1. deploy.yml

**Description:** This is used for deploying our application stack which involves multiple moving parts such as performing database backups, pulling the latest LMDB changes, and launching the application.

2. elk_setup.yml

**Description:** This is used for deploying our Elastic (ELK) stack. Our ELK stack is used for searching uploaded files, system logs, service logs, and other miscellaneous tasks such as searching for LMDB terms.

3. proxy.yml

**Description:** This is used for deploying [Traefik](https://doc.traefik.io/traefik/) which is our reverse proxy/gateway into our cloud structure. This is important to setup if we want to route any new domains/subdomains to our virtual machines within Google Cloud.

4. maintenance.yml

**Description:** This is used in conjunction with `proxy.yml` to redirect all of our external traffic to a maintenance page.

5. filebeat_setup.yml

**Description:** This is used for installing a logging service which will extract Docker logs and send them to our Elasticsearch instance. Each of our virtual machines that use Docker should have this installed so we may monitor the results of those machines.

### 3. Deploying A Brand New Environment
Now that we know what each playbook is for, we'll look into what is involved to setup a new *environment* of our application. The word *environment* here is used to refer to a different environment (e.g. dev, production, qa, demo, etc). For the following examples, we're going to show you how to deploy a hypothetical environment called "DEMO"

1. First, we have to modify the `hosts.yml` file under the `ansible` directory. Under the *IP Address Here* in the configuration file below, add the *external* IP address of the virtual machine we've created in the **Application (API) Service Setup** step. If you recall, we assigned a reserved static ip address to our virtual machine so Ansible can always refer to the machine we want.

**hosts.yml**
```yaml
all:
    children:
        elk:
            hosts:
                35.238.72.201:
        webservers:
            hosts:
                35.223.19.98:
                34.67.176.248:
                35.225.4.84:
                34.69.0.24:
        qa:
            hosts:
                35.225.4.84:
        demo:
            hosts:
                <IP ADDRESS HERE>:
        staging:
            hosts:
                34.67.176.248:
        prod:
            hosts:
                34.69.0.24:
        traefik:
            hosts:
                35.239.196.222:
```

2. Under `ansible/inventories/group_vars` we'll create a folder named **demo**. The name is important here and has to match what we specified in our `hosts.yml` for our machine. Ansible uses this to find the correct folder for using interpreting defined variables.
3. Copy and paste the files found under `ansible/inventories/group_vars/prod` into the new **demo** folder created. We copy and paste since most of our application environments use a similar structure but with different values assigned to the variables.
4. Rename the `prod-vault.yml` file to `demo-vault.yml`. Notice the `-vault.yml` suffix. We try to stick with this convention to tell us that this is an Ansible encrypted file. We can decrypt this file via `ansible-vault decrypt <filename>`. You'll be prompted for the password which can be found by downloading the vault password `gsutil cp gs://kg-secrets/.vault_secrets_pw .`
5. Under the `vars.yml` file, configure the values to look something like
```yaml
app_environment: demo
elastic_file_content_index_id: file_demo
```
6. Under the `demo-vault.yml`, modify all of the variables to match what the DEMO environment should contain. Variables in here are meant to be kept secret and are variables referring to database ip addresses, passwords, and other sensitive information.
7. Next, we will want to install **Filebeat** onto our virtual machine to have it start sending logs to our Elasticsearch service.
```bash
ansible-playbook -i inventories --vault-password-file=.vault_secrets_pw playbooks/filebeat_setup.yml --extra-vars "webserver=demo"
```
Notice how we passed "demo" as a value to the parameter "webserver". If we looked into the `filebeat_setup.yml` file we'd see that the parameter "webserver" is associated with the "hosts" setting in the configuration file. Ansible associates the value we place in "hosts" with the "group_vars" folder (e.g. so in our case, it will try to find a folder named "demo" under "group_vars" to link all of the variable files for the duration of the `filebeat_setup.yml` script. In addition to the folder specific variables, Ansible will load everything under the "group_vars/all" folder.

8. **(Optional)** Next, we'll configure **Traefik** to pick up our new virtual machine so we can route a subdomain to it. Under `deployment/ansible/playbooks/roles/traefik/files` there's a file named `services.yml`. We'll modify it to add our new DEMO environment. Take note that the `IP ADDRESS HERE` should be the **internal** ip address of your virtual machine. If you revisit the Google Compute Engine menu, you'll see an *external* and *internal* ip address.

```yaml
http:
  routers:

    ***ARANGO_DB_NAME***-demo:
      entryPoints:
        - websecure
      rule: "Host(`demo.***ARANGO_DB_NAME***.bio`)"
      service: ***ARANGO_DB_NAME***-demo-service
    tls:
      certResolver: "le"
      domains:
        certResolver: "le"
        domains:
          - main: "demo.***ARANGO_DB_NAME***.bio"
    ***ARANGO_DB_NAME***-qa:
      entryPoints:
        - websecure
      rule: "Host(`qa.***ARANGO_DB_NAME***.bio`)"
      service: ***ARANGO_DB_NAME***-qa-service
      tls:
        certResolver: "le"
        domains:
          - main: "qa.***ARANGO_DB_NAME***.bio"
  ...
  services:
    ***ARANGO_DB_NAME***-demo-service:
      loadBalancer:
        servers:
          - url: <INTERNAL IP ADDRESS HERE>
    ***ARANGO_DB_NAME***-qa-service:
      loadBalancer:
        servers:
          - url: "http://10.128.15.243"
    ...

```

9. Run the `proxy.yml` playbook to add the new settings to the Traefik server
```bash
ansible-playbook -i inventories --vault-password-file=.vault_secrets_pw playbooks/proxy.yml
```
**Note:** You won't see anything at the route until you deploy the application
10. Deployment will then occur during the GitHub actions phase which is described below.

### Phase 3 - GitHub Environment Setup

In short, GitHub actions helps ties our new code changes and the deploy process together. We can visualize the sequence of events as follows
1. Developer pushes code to master
2. GitHub actions notices this change
3. GitHub actions triggers a workflow
4. The workflow will build our docker images and push them to the Google Container registry
5. The workflow will run our `deploy.yml` Ansible script
6. `deploy.yml` script summary
    1. installs Docker onto the virtual machine
    2. authorizes the virtual machine to pull from the Google Container registry
    3. pulls down the docker images that were built in **Step 4**
    4. copies the docker-compose files to the server
    5. creates an environmental file needed to run the application
    6. stops any previous running docker containers
    7. starts the new docker containers
    8. removes unused docker images
    9. runs database backups and stores into the Google Cloud storage
    10. runs the database data and schema migrations
    11. create/update lmdb files
    12. seeds elasticsearch with global annotations (can probably deprecate)

Our current GitHub actions are triggered through either `tags`, `drafting new release`, or using the `manual workflow deploy button` (see [source](https://github.blog/changelog/2020-07-06-github-actions-manual-triggers-with-workflow_dispatch/)). These are all shown in the [Quickstart](#quickstart). It's important to point out that we do not need GitHub actions to deploy. We could also run `deploy.yml` locally, BUT the largest caveat is we'd need to build the docker images and push them to the Google Cloud registry ourselves since GitHub actions usually takes care of this.
