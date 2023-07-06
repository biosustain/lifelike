# How to Deploy Lifelike Public

## Why Does This Guide Exist?

We recently discovered that a deployment of the public ***ARANGO_DB_NAME*** installation was completely offline. At the time of writing, it is still unknown what caused the installation to go offline, and it is not clear how it was originally deployed. We *were* able to restore our [Keycloak](https://www.keycloak.org/) installation, but the main Lifelike application remains inaccessible.

So, where did this leave us? Because we have a (mostly) well-documented architecture for deploying Lifelike to Google Cloud, we decided to create a hybrid deployment of the public installation. In short, Keycloak is still running on the Azure Kubernetes cluster "***ARANGO_DB_NAME***-k8s-test", but the Lifelike application is running on a Google Cloud VM via a handful of Docker containers. The two services can communicate with one another in such a way that makes this new deployment mostly indistinguishable from the original.

There are also a handful of idiosyncrasies related to deploying on Google Cloud with the current architecture that are not well-documented; this guide attempts to identify these quirks and provide solutions/workarounds to them when possible.

## Introduction

As mentioned in the previous section, this guide describes how to deploy a brand new installation of the public version of Lifelike on Google Cloud. Note that while the guide assumes a deployment of the public version, it can be extended to any version of Lifelike as well. This guide primarily serves to document how to setup a new environment on Google Cloud, and is not necessarily specific to the public Lifelike version.

## How the Azure Kubernetes Cluster Fits in to the Deployment

For the most part, you can entirely ignore the services running in the Kubernetes cluster. You will not need to update these services, but you will need to gather some information about them. Particularly, some values for the Keycloak server. Thankfully, these have already been gathered together for the new public deployment. You can view the vault file for the public deployment for a full list of the values required to deploy the application.

## Create the New Compute Engine VM

The very first step in creating a new Lifelike environment is creating a VM to host the Docker containers. It is highly recommended that you [create a similar](https://cloud.google.com/compute/docs/instances/create-vm-from-similar-instance) VM from an existing machine, rather than create one from scratch. You can use "***ARANGO_DB_NAME***-staging" as a good example.

If you create from a similar VM, there are several very crucial steps you need to follow to ensure the Ansible deployment (more on that later) goes well:

### Disable OS Login

[OS Login](https://cloud.google.com/compute/docs/oslogin) is enabled *silently* by default on new Google Cloud VMs. When this feature is enabled, classic SSH sign-in is effectively *disabled*. This interferes with the Ansible deployment's ability to connect to the VM. Ideally, we would update the Ansible workflow to use an authorized Google service account, but until then we must disable OS Login.

To disable OS Login, navigate to the details page of your new VM. Then, click on the "Edit" button to open the editing view for the machine. At the bottom of the edit details page, you should see a field called "Custom Metadata". Add a new entry to this field called "enable-oslogin" and assign it the value "FALSE" Don't forget to save your changes!

### Add the Public Key for the Ansible User

Once OS Login is disabled, you can add SSH keys manually to the VM. But first, you need to download the public key so you can put it on the server. In the Google Cloud Console, navigate to Cloud Storage > Buckets > kg-secrets. The public key you need is called "ansible-runner.pub". Download it, and open it in your favorite text editor.

Next, once again navigate to the "Edit" page for your VM, and go to the "SSH Keys" field under "Security and access". Copy the entire content of the "ansible-runner.pub" key you downloaded earlier, and paste it into a new SSH Key field. Finally, save the changes.

The VM should now be configured to allow connections from the Ansible runner.

### Reserve a Static External IP Address

If you create the new VM from an existing Lifelike machine, this step should be done for you automatically. If not, it is straightforward to reserve a public IP address. Follow [these](https://cloud.google.com/compute/docs/ip-addresses/reserve-static-external-ip-address) instructions to do so.

Note that we will be using this IP address in a later step, so write it down somewhere convenient.

### Reserve a Domain Name for the New Environment

At the time of writing, this step is optional. We currently have DNS configured to capture any routes to `*.***ARANGO_DB_NAME***.bio` and direct them to the Traefik server (more on that later). If for some reason the DNS has changed, adding a new entry is straightforward. In the Google Cloud Console, navigate to Networking Services > Cloud DNS. Then, click the "Add Standard" button to create a new DNS standard. You will then need to fill out the form for creating a new standard. The important fields are "Record type" and "DNS Name". You will likely want an "A" record, and the DNS name should match the pattern `*.***ARANGO_DB_NAME***.bio` e.g. `public.***ARANGO_DB_NAME***.bio`. For IP address, add the external IP address of the Traefik server.

## Update Keycloak to Connect to the New Installation

This step is currently only required for the public installation, and only if you are creating a *new* install of public.

### Export the Configurations for the Existing Public Realm

[These](https://gist.github.com/axdotl/c1f97e62c18294e8de550fa5d2ac4661) instructions were very helpful as a starting point.

There is a backup of the public Keycloak installation in the "kg-secrets" storage bucket on Google Cloud. Please use the backup only if you cannot follow the instructions below:

1. Turn off the cache in the release yaml, and then upgrade:

    ```yaml
    cache:
        enabled: false
        stackFile: ""
        stackName: kubernetes
    ```

2. Open a shell into the Keycloak Pod and navigate to `/opt/bitnami/keycloak`
3. Run `mkdir backups`
4. Run `bin/kc.sh export --dir ./backups --users skip --realm ***ARANGO_DB_NAME***-public`
5. You should see something like the following as output:

    ```text
    2023-07-03 19:41:38,287 INFO  [org.keycloak.quarkus.runtime.hostname.DefaultHostnameProvider] (main) Hostname settings: Base URL: <unset>, Hostname: <request>, Strict HTTPS: false, Path: <request>, Strict BackChannel: false, Admin URL: <unset>, Admin: <request>, Port: -1, Proxied: true
    2023-07-03 19:41:39,659 INFO  [org.keycloak.common.crypto.CryptoIntegration] (main) Detected crypto provider: org.keycloak.crypto.def.DefaultCryptoProvider
    2023-07-03 19:41:41,396 WARN  [org.infinispan.CONFIG] (keycloak-cache-init) ISPN000569: Unable to persist Infinispan internal caches as no global state enabled
    2023-07-03 19:41:41,438 WARN  [org.infinispan.PERSISTENCE] (keycloak-cache-init) ISPN000554: jboss-marshalling is deprecated and planned for removal
    2023-07-03 19:41:41,452 INFO  [org.infinispan.CONTAINER] (keycloak-cache-init) ISPN000556: Starting user marshaller 'org.infinispan.jboss.marshalling.core.JBossUserMarshaller'
    2023-07-03 19:41:41,780 INFO  [org.infinispan.CONTAINER] (keycloak-cache-init) ISPN000128: Infinispan version: Infinispan 'Triskaidekaphobia' 13.0.9.Final
    2023-07-03 19:41:42,257 INFO  [org.keycloak.connections.infinispan.DefaultInfinispanConnectionProviderFactory] (main) Node name: node_376914, Site name: null
    2023-07-03 19:41:42,621 INFO  [org.keycloak.exportimport.dir.DirExportProvider] (main) Exporting into directory /opt/bitnami/keycloak/./backups
    2023-07-03 19:41:43,119 INFO  [org.keycloak.services] (main) KC-SERVICES0034: Export of realm '***ARANGO_DB_NAME***-public' requested.
    2023-07-03 19:41:44,144 INFO  [org.keycloak.exportimport.dir.DirExportProvider] (main) Realm '***ARANGO_DB_NAME***-public' - data exported
    2023-07-03 19:41:44,211 INFO  [org.keycloak.services] (main) KC-SERVICES0035: Export finished successfully
    2023-07-03 19:41:44,570 ERROR [org.keycloak.quarkus.runtime.cli.ExecutionExceptionHandler] (main) ERROR: Failed to start server in (import_export) mode
    2023-07-03 19:41:44,571 ERROR [org.keycloak.quarkus.runtime.cli.ExecutionExceptionHandler] (main) ERROR: Unable to start HTTP server
    2023-07-03 19:41:44,571 ERROR [org.keycloak.quarkus.runtime.cli.ExecutionExceptionHandler] (main) ERROR: io.quarkus.runtime.QuarkusBindException
    2023-07-03 19:41:44,572 ERROR [org.keycloak.quarkus.runtime.cli.ExecutionExceptionHandler] (main) For more details run the same command passing the '--verbose' option. Also you can use '--help' to see the details about the usage of the particular command.
    ```

6. `cd` to the `/backups` folder we created and verify the export exists with `ls`

7. Exit the shell, and in your terminal run:

```bash
kubectl cp keycloak/keycloak-1669925165-0:opt/bitnami/keycloak/backups/<backup-name-here> path/to/your/desired/export/location/***ARANGO_DB_NAME***-public-realm.json
```

You should now see the export on your local machine! Also, don't forget to re-enable the cache for the Keycloak release:

```yaml
cache:
  enabled: true
  stackFile: ""
  stackName: kubernetes
```

### Import the Exported Keycloak Public Config to a New Realm

Before you begin, make sure your export file uses a unique ID for the realm! If you ran an export just before starting these instructions your export file probably still has the original ID. It should be a 32-character UUID at the top of the export file:

```json
{
  // Example:
  "id" : "de346121-e3e2-434b-b5c8-a34e18e66c1d",
  // ...
}
```

In fact, you will need to remove any lines that contain a UUID, which should be a 32-character string separated by "-". You can search for "_id", "id", and "Id" to find properties with UUID values.

Unlike the export process, you can actually import a new realm from the Keycloak admin web UI. Log in with the admin credentials, then under the realm dropdown list in the top-left of the screen, select "Create Realm". On the next page, simply copy/paste your export file or use the file select widget to browse your filesystem. Click "Create" and your new realm should be created automatically.

If you encounter any errors during the import, you can check the pod logs to see what the error is.

### Update Signing Keys for New Realm

There is one more step required before the new Keycloak realm is ready to be used with the public install. For some reason, our Python installation is not compatible with the default JWT signing keys used by Keycloak. To work around this, you can turn off the incompatible keys.

To do this, navigate to Realm Settings > Keys > Providers. Then, for both "rsa-generated" and "rsa-enc-generated", set "Enabled" and "Active" to off. Save the changes, and Keycloak will be ready to use.

If you DON'T follow these instructions, you will likely notice something like the following in the appserver logs:

```text
Traceback (most recent call last):
  File "/usr/local/lib/python3.8/site-packages/flask/app.py", line 1948, in full_dispatch_request
    rv = self.preprocess_request()
  File "/usr/local/lib/python3.8/site-packages/flask/app.py", line 2242, in preprocess_request
    rv = func()
  File "/home/n4j/app.py", line 78, in default_login_required
    return login_required_dummy_view()
  File "/usr/local/lib/python3.8/site-packages/flask_httpauth.py", line 100, in decorated
    if not self.authenticate(auth, password):
  File "/usr/local/lib/python3.8/site-packages/flask_httpauth.py", line 265, in authenticate
    return self.verify_token_callback(token)
  File "/home/n4j/neo4japp/blueprints/auth.py", line 148, in verify_token
    decoded = token_service.decode_token(token, audience=current_app.config['JWT_AUDIENCE'])
  File "/home/n4j/neo4japp/blueprints/auth.py", line 119, in decode_token
    key=self._get_key(token),
  File "/home/n4j/neo4japp/blueprints/auth.py", line 85, in _get_key
    return jwt_client.get_signing_key_from_jwt(token).key
  File "/usr/local/lib/python3.8/site-packages/jwt/jwks_client.py", line 59, in get_signing_key_from_jwt
    return self.get_signing_key(header.get("kid"))
  File "/usr/local/lib/python3.8/site-packages/jwt/jwks_client.py", line 41, in get_signing_key
    signing_keys = self.get_signing_keys()
  File "/usr/local/lib/python3.8/site-packages/jwt/jwks_client.py", line 28, in get_signing_keys
    jwk_set = self.get_jwk_set()
  File "/usr/local/lib/python3.8/site-packages/jwt/jwks_client.py", line 25, in get_jwk_set
    return PyJWKSet.from_dict(data)
  File "/usr/local/lib/python3.8/site-packages/jwt/api_jwk.py", line 92, in from_dict
    return PyJWKSet(keys)
  File "/usr/local/lib/python3.8/site-packages/jwt/api_jwk.py", line 87, in __init__
    self.keys.append(PyJWK(key))
  File "/usr/local/lib/python3.8/site-packages/jwt/api_jwk.py", line 50, in __init__
    raise PyJWKError("Unable to find a algorithm for key: %s" % self._jwk_data)
jwt.exceptions.PyJWKError: Unable to find a algorithm for key:
```

## Update Ansible to Include the New Hostname

You will need to update the Ansible services hosts file to include the new IP address created in a previous step. In the file deployment > ansible > inventories > hosts.yml, you will need to add a new entry for the machine:

```yaml
all:
  children:
    # --------------------------------------------------
    # Lifelike Docker Compose hosts
    # --------------------------------------------------

    # ...

    ***ARANGO_DB_NAME***-public:
      hosts:
        <YOUR_IP_ADDRESS>:
```

The config should look like the above. Remember, indentation is important in YAML files!

## Add a Ansible Vault File for the New Environment

Each of our deployments has an associated Ansible Vault file. This is essentially an environment file containing a list of secret values (e.g., passwords, IP addresses, tokens, etc.). You will need to add a vault file for the new deployment. To do so, checkout the "***ARANGO_DB_NAME***-infra" repository. There are quite a few branches for this repo, but you will most likely use whatever the "kg-prototypes" repo refers to under the "deployment" submodule. If you check out the master branch for "kg-prototypes", the linked "***ARANGO_DB_NAME***-infra" branch will be checked out under the `/kg-prototypes/deployment` folder.

Once you've identified which branch you are interested in, navigate to the `/deployment/ansible/inventories/group_vars` folder. There, you should notice a handful of additional folders for each deployment, e.g. `***ARANGO_DB_NAME***-staging`. You will also notice each has at least a file called "vault.yml", this is the Ansible Vault file for that deployment.

Create a folder for your deployment. Naming is important here! If you recall the "hosts.yml" file we updated earlier, the name you choose for the folder *must* match the name of the host you added there, e.g., `***ARANGO_DB_NAME***-public`. Then, create a new vault file with:

```bash
ansible-vault create vault.yml
```

Make sure to keep track of the vault password you create!

If you don't have the Ansible CLI installed, you can follow [these](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html) instructions to do so.

Once you have created the vault file, you will need to add any necessary environment variables for the deployment to it. For example, database connection info, logging levels, and so on. To view an existing vault file, you can run:

```bash
ansible-vault view vault.yml
```

And to edit:

```bash
ansible-vault edit vault.yml
```

## Ensure the Postgres DB Allows Incoming Connections From the VM

If you haven't yet created a Postgres database for the new deployment, do so before continuing. You can follow [these](https://cloud.google.com/sql/docs/postgres/create-manage-databases) instructions as a general guide for creating a new database instance.

Once you have a database instance ready, you will need to whitelist the address of the VM we created in previous steps.

### Whitelisting on Google

To whitelist connections from the new VM on a Google SQL instance, first navigate to SQL > <Your_Instance> > Connections > Networking. Then, under "Authorized Networks", add the external IP address of the VM you created.

Your VM is now ready to send requests to the SQL server!

### Whitelisting on Azure

Whitelisting on Azure is very similar to the process on Google. First, navigate to the overview page for your cloud SQL instance. Then, navigate to the "Networking" view. Under "Firewall Rules", enter a name for the new rule, and enter the external IP adress of the VM for both the start and end address. Make sure to use a descriptive name for the rule!

The VM is now ready to send requests to the SQL server!

## Update the Traefik Services File to Include the New Environment

We use [Traefik](https://traefik.io/traefik/) as the proxy service for our Google Cloud deployments. Updating the Traefik deployment to include a newly deployed service is relatively straightforward, however it does require logging into the VM and manually updating some configurations. At the time of writing the VM is called "traefik-proxy".

You will need to login to the Traefik VM either as the "ansible" user. If you don't have the ssh keys needed to log in, you can find them in the "kg-secrets" storage bucket. The private key (the one you need to SSH into the VM) is called "ansible-traefik". Once you have downloaded the key, you can log in to the VM using the following command:

```bash
ssh -i /path/to/private/key/ansible-traefik ansible@<traefik-proxy-IP>
```

Note that you may need to update the permissions on the key to be readable only by you. You can do this by changing the permissions with `chmod`:

```bash
chmod 600 /path/to/private/key/ansible-traefik
```

After a few moments you should see that your terminal is logged in to the Traefik VM!

### What if Logging in Via SSH Fails?

If you can't log in with SSH using the steps above, you can try a couple of things:

1. Get a private key from someone who does have access. If a colleague has a working key-pair, they can give it to you.
    - Alternatively, your colleague could add the public key you have to the `.ssh` folder of the "ansible" user.
2. Log in as another user. If you can log in as your Google account, and you have docker access, you can continue to the next step without logging in as the "ansible" user.
    - Normally ansible operations are performed automatically by this user, so we prefer to use it instead of any other user. But, a user by any other name would run just as fine.
3. Log in as ***ARANGO_USERNAME***. If all else fails, you can use ***ARANGO_USERNAME*** login to continue. This is highly discouraged, and should frankly not be possible. You will need the password for the ***ARANGO_USERNAME*** user, which can be found in the startup script under the custom metadata field of the Traefik VM. You can then log in with the following command: `ssh ***ARANGO_USERNAME***@<traefik-proxy-IP>`. Once logged in, it is highly encouraged to add whatever SSH keys you were attempting to use to the `.ssh` folder of the "ansible" user, and then continue with the guide normally.

Once you have logged in to the machine, you will need to navigate to the `/opt/traefik` folder. There, you should see a file called `services.yml`. Open this file with a text editor. There should be a top-level mapping like this:

```yaml
http:
    routers:
        # ...
    services:
        # ...
```

You will need to add a single entry to both of these lists, like so:

```yaml
http:
    routers:
        ***ARANGO_DB_NAME***-public:
            entryPoints:
                - websecure
            rule: "Host(`public.***ARANGO_DB_NAME***.bio`)"
            service: ***ARANGO_DB_NAME***-public-service
            tls:
                certResolver: "le"
                domains:
                    - main: "public.***ARANGO_DB_NAME***.bio"
    services:
        ***ARANGO_DB_NAME***-public-service:
            loadBalancer:
                servers:
                - url: "http://INTERNAL-VM-IP"
```

Notice that the new "services" entry uses the *internal* IP address of the VM, NOT the *external* IP.

Finally, you will also need to restart the traefik service. We currently have this running in docker, with the compose file located in `/home/ansible/`. Navigate to this folder and then run:

```bash
docker-compose restart
```

## Add a Github Action Workflow for the New Environment

You will need to add a new workflow file to the list of Github Action workflows within the "kg-prototypes" repository. These can be found under `/kg-prototypes/.github/workflows`. Your new file should look like:

```yaml
name: GCP <Your Environment Name Here> Deployment

on:
  workflow_dispatch:
  push:
    tags: [new-env]
    branches: [new-env/**]

jobs:
  call-deployment-gcp:
    uses: ./.github/workflows/deployment-gcp.yml
    with:
      environment_name: new-env
      client_config: production
      cloud_sql_instance_name: ***ARANGO_DB_NAME***-new-env
    secrets:
      VAULT_PASSWORD: ${{ secrets.ANSIBLE_VAULT }}
      SSH_KEY: ${{ secrets.ANSIBLE_PRIVATE_SSH_KEY }}
      CONTAINER_REGISTRY_USERNAME: ${{ secrets.AZURE_CR_USERNAME }}
      CONTAINER_REGISTRY_PASSWORD: ${{ secrets.AZURE_CR_PASSWORD }}
      GCP_CREDENTIALS: ${{ secrets.GCE_SA_KEY }}
      INFRA_PAT: ${{ secrets.INFRA_PAT }}
```

You will then need to commit this file to the main branch of the repository so it can be used from the Actions GUI.

## Push the Updated Files to the kg-prototypes and ***ARANGO_DB_NAME***-infra Repos

Almost done! We've updated a few files during our setup, namely the ansible `hosts.yml` file, and the vault file for our new environment. We've also added a new workflow file for the Github Actions. We need to commit and deploy these changes in order for the Github Action workflow to succeed.

The workflow file *must* by committed to the "master" branch of the "kg-prototypes" repo. This is required to enable the new workflow to appear in the GUI.

Once you've committed and pushed the new workflow file, it is highly recommended to create a new branch for the next changes. This ensures no erroneous changes are accidentally committed to the main branch of Lifelike.

After creating a new branch, navigate to the "deployment" repo in your terminal. It is recommended to create a new branch here as well, for the same reason as above. When you are ready, commit and push the files we've updated to your new branch.

Finally, if you check the status of the "kg-prototypes" repo you should notice Git is reporting uncommitted changes for the "deployment" submodule reference:

```bash
Your branch is up to date with 'origin/your-branch-here'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git checkout -- <file>..." to discard changes in working directory)
  (commit or discard the untracked or modified content in submodules)

        modified:   deployment (modified content)

no changes added to commit (use "git add" and/or "git commit -a")
```

You can stage and commit this change just like any other file, and will need to do so in order for this branch to use the "deployment" branch we just pushed. Push the commit, and you will be ready to run the Github Action from the GUI!

## Run the Github Action

Finally, you simply need to open the "Actions" page on the "kg-prototypes" repo and select the workflow from the left-hand panel. Then, under the "workflow runs" view, select the branch we created earlier from the "Run workflow" dropdown, and run the workflow.

If everything has been configured correctly, after about 20 minutes you should see the workflow complete, and when you navigate to the new site you should see an active Lifelike deployment!
