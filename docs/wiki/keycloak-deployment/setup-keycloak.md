# How to Setup Keycloak on Kubernetes

## Glossary

- [Introduction](#introduction)
- [Setup the Kubernetes Cluster](#setup-the-kubernetes-cluster)
  - [Create A New Kubernetes Cluster](#create-a-new-kubernetes-cluster)
  - [Add the Cluster Credentials to Your Local Kube Config (Optional)](#add-the-cluster-credentials-to-your-local-kube-config-optional)
- [Install Keycloak](#install-keycloak)
- [Import An Existing Lifelike Realm Into the New One](#import-an-existing-***ARANGO_DB_NAME***-realm-into-the-new-one)
  - [Export the Configurations for the Existing Realm](#export-the-configurations-for-the-existing-realm)
  - [Import the Exported Keycloak Public Config to a New Realm](#import-the-exported-keycloak-public-config-to-a-new-realm)
  - [Update Signing Keys for New Realm](#update-signing-keys-for-new-realm)

## Introduction

This guide will walk you through installing [Keycloak](https://www.keycloak.org/) for use with Lifelike. You will need to either install the [Google Command Line Interface (CLI)](https://cloud.google.com/sdk/docs/install) and [Kubernetes](https://kubernetes.io/docs/tasks/tools/) locally, or use the online Google CLI to follow along with this guide. You will also need to install [Helm](https://helm.sh/) if following the instructions locally.

## Setup the Kubernetes Cluster

Complete the following instructions if you need to create a new Kubernetes cluster for the Keycloak installation. Otherwise, simply switch to the cluster you would like to use before proceeding to the following section.

### Create A New Kubernetes Cluster

In your terminal, run the following:

```bash
gcloud container clusters create \
  --machine-type n1-standard-2 \
  --num-nodes 2 \
  --zone us-central1 \
  --cluster-version latest \
  <your-cluster-name-here>
```

Replace the last line with the name of your new cluster. This will start the process of creating a new cluster on Google Cloud. This may take up to 15 minutes.

### Add the Cluster Credentials to Your Local Kube Config (Optional)

If you are following these instructions locally, you will need to add the cluster to your kube config. To do so, simply run:

```bash
gcloud container clusters get-credentials keycloak --internal-ip
```

## Install Keycloak

Note that you can find samples for each of the files referenced in this section in the same folder as these notes.

Once you have set your kube context to the cluster you would like to work with, run the following:

1. Create a namespace for the Keycloak resources

    ```kubectl create namespace keycloak```

2. Install [Cert Manager](https://cert-manager.io/) to the cluster if it isn't installed already:

    ```apply -f https://github.com/jetstack/cert-manager/releases/download/v1.8.1/cert-manager.yaml```

3. Install a development cluster issuer for SSL certs:

    ```kubectl apply -f cluster-issuer-stg.yml -n keycloak```

4. Download and install [Nginx Ingress](https://github.com/kubernetes/ingress-nginx) with Helm:

    ```bash
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
    helm install keycloak-ingress-nginx ingress-nginx/ingress-nginx -n keycloak -f ingress-nginx-helm-values.yml
    ```

5. Install keycloak with Helm:

    ```helm install keycloak oci://registry-1.docker.io/bitnamicharts/keycloak --version=15.1.3 -n keycloak -f config.yml```

6. Confirm that you can reach the Keycloak server in your web browser by visiting the [web GUI](https://auth.az.***ARANGO_DB_NAME***.bio)

    - At this point, you should see that the cert is not valid because we've used the staging Let's Encrypt certificate. Check the certificate by clicking on the cert info button on your browser to confirm. If it is the staging certificate, then the reverse proxy and cert manager configuration is correct, and you can continue.

7. Add the production cluster issuer:

    ```kubectl apply -f cluster-issuer-prod.yml -n keycloak```

8. Update the release to use the production cluster issuer:

    ```bash
    # Replace this:
    cert-manager.io/cluster-issuer: letsencrypt-staging

    # With this:

    cert-manager.io/cluster-issuer: letsencrypt-prod
    ```

9. Upgrade the release:

    ```helm upgrade keycloak oci://registry-1.docker.io/bitnamicharts/keycloak --version=15.1.3 -n keycloak -f config.yml```

10. Confirm that you can reach the Keycloak server in your web browser by visiting the [web GUI](https://auth.az.***ARANGO_DB_NAME***.bio)

    - You should now see the HTTPS lock in your browser search bar, with no complaints from the browser.

You now have a new Keycloak installation reachable at the [web GUI](https://auth.az.***ARANGO_DB_NAME***.bio). Proceed to the next section if you would like to import an existing realm into the new installation.

## Import An Existing Lifelike Realm Into the New One

The following instructions will demonstrate how to export and re-import an existing Keycloak realm into the new installation. They aren't strictly required, but it is highly encouraged to start from a well-known, working starting point. [These](https://gist.github.com/axdotl/c1f97e62c18294e8de550fa5d2ac4661) instructions were also very helpful.

### Export the Configurations for the Existing Realm

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

## Update Signing Keys for New Realm

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
