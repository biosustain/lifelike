# How to Setup Binderhub for Kubernetes

## Glossary

- [Introduction](#introduction)
- [Caveats](#caveats)
- [Create the Cluster](#create-the-cluster)
  - [Create a Namespace for the Binderhub Resources](#create-a-namespace-for-the-binderhub-resources)
- [Setup the Nginx Load Balancer](#setup-the-nginx-load-balancer)
  - [Reserve a Static IP Address](#reserve-a-static-ip-address)
  - [Configure DNS with the Static IP](#configure-dns-with-the-static-ip)
  - [Install cert-manager](#install-cert-manager)
  - [Create a Temporary Certificate Issuer](#create-a-temporary-certificate-issuer)
  - [Add and Install Ingress NGINX](#add-and-install-ingress-nginx)
  - [Optional: Add a Config Map for the NGINX Proxy](#optional-add-a-config-map-for-the-nginx-proxy)
- [Install Binderhub](#install-binderhub)
- [Verify SSL Certs are Created](#verify-ssl-certs-are-created)
- [Additional Configurations](#additional-configurations)

## Introduction

This guide will walk you through the process of creating a brand-new Binderhub cluster on Google Cloud. The example configuration files can also be used for other cloud services.

If you do not have a Google Cloud account or project, you can create one by following the instructions [here](https://cloud.google.com/resource-manager/docs/creating-managing-projects).

The guide also primarily uses the Google Cloud Console Terminal, so you do not need to worry about navigating around the GUI to the various resources we create.

If you want to install the Google Cloud CLI on your machine, consult this [guide](https://cloud.google.com/sdk/docs/install).

Finally, we will be using [Helm](https://helm.sh/) to create several Kubernetes resources. Please install Helm locally if you wish to follow this guide on a local terminal.

## Caveats

These intructions assume you will be using the configuration files provided alongside the guide. This will enable a few additional features not included in a vanilla BinderHub deployment.

Most notably, user authentication will be turned on, with Google as the OAuth provider. If you do not require any authentication (highly discouraged), you can use the config-with-no-auth.yaml file instead of the recommended config-stg.yaml and config-prod.yaml.

Also, do note the `GithubRepoProvider` property under the top-level `config` mapping. This is currently configured to ONLY ALLOW Github repositories from within the SBRG organization to be used with the BinderHub deployment.

Finally, recognize that some of the values in the BinderHub configuration may need to be changed to accurately identify the resources you create. In other words, you might need to change some names, but otherwise the general structure of the configuration should be correct.

## Create the Cluster

First, create the cluster we will install Binderhub on to:

```bash
gcloud container clusters create \
  --machine-type n1-standard-2 \
  --num-nodes 2 \
  --zone us-central1 \
  --cluster-version latest \
  <your-cluster-name-here>
```

Next, set the admin role binding for your Google Cloud account. This will ensure you're able to make changes to the cluster we've just created:

```bash
kubectl create clusterrolebinding cluster-admin-binding \
  --clusterrole=cluster-admin \
  --user=<your-gcloud-username-here>
```

### Create a Namespace for the Binderhub Resources

We will want to create a namespace so we can easily identify the resources created for binderhub within our new cluster. Create a new namespace:

```bash
kubectl create namespace <your-namespace-here>
```

The namespace can be anything, but be sure to give it a descriptive name like "***ARANGO_DB_NAME***-binderhub" or just "binderhub". This guide will simply use "binderhub" from here on out.

## Setup the Nginx Load Balancer

Before we install Binderhub, we will first install a load balancer to handle requests to the binder server.

### Reserve a Static IP Address

The load balancer will need a static IP so we can be certain the address won't change. You can reserve a static IP on Google Cloud with the following command:

```bash
gcloud compute addresses create <your-ip-address-name-here> --region us-central1
```

You can name the IP address whatever you want, but use something descriptive like "***ARANGO_DB_NAME***-binderhub-proxy". If you'd like a more in-depth explanation of how to reserve a static IP, please follow the [official guide](https://cloud.google.com/compute/docs/ip-addresses/reserve-static-external-ip-address).

### Configure DNS with the Static IP

Registering a domain name is beyond the scope of this guide, but you will need a domain to use for an authenticated Binderhub server. If you are using Google Cloud, DNS zones can be configured under: Networking > Network Services > Cloud DNS.

Very minimally, you will need to create two new zone standards (most likely A records) for both the BinderHub server and the Jupyterhub server. For example, for the Lifelike project we have the "***ARANGO_DB_NAME***.bio" DNS zone, with A records for "binder.***ARANGO_DB_NAME***.bio" and "jupyter.***ARANGO_DB_NAME***.bio" pointing at the IP address "35.188.33.138". This means that the domains "binder.***ARANGO_DB_NAME***.bio" and "jupyter.***ARANGO_DB_NAME***.bio" refers to the IP address "35.188.33.138", which itself identifies the load balancer server.

Note that it may take a few minutes for any newly registered domain names to be accessible.

### Install cert-manager

We will be using [cert-manager](https://cert-manager.io/) and [lets-encrypt](https://letsencrypt.org/) to generate SSL certificates for the Binderhub server. Install cert-manager on the cluster with:

```bash
kubectl apply -f https://github.com/jetstack/cert-manager/releases/download/v1.8.1/cert-manager.yaml
```

### Create a Temporary Certificate Issuer

A certificate issuer is used to generate certificates for services within the cluster. We will be generating certificates for both the `binderhub` and `jupyterhub` services later, but for now, we only need to define two issuers: a dev issuer and a prod issuer. You can create an issuer like so:

```bash
kubectl apply -f your-issuer-def-file.yaml --namespace=binderhub
```

The `-f` command specifies a resource definition file to use for the new resource.

It is strongly recommended that you use a development issuer while setting up the Binderhub server to avoid exceeding issuing quotas from lets-encrypt. Errors in the setup of the Binderhub server can also be obscured by errors with the SSL certificate configuration, so it is best to use a development issuer until you are sure your configurations are correct!

See the example "cluster-issuer-stg.yaml" and "cluster-issuer-prod.yaml" files included in the same directory as this guide. The former is an example of a development issuer.

### Add and Install Ingress NGINX

We will use [ingress-nginx](https://github.com/kubernetes/ingress-nginx) as the load balancer for the Binderhub and Jupyterhub services. If you don't already have `ingress-nginx` added to your list of helm repositories, do so now:

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
```

If you already have it added, you may also wish to update your release of `ingress-nginx` with:

```bash
helm repo update
```

Finally, you can install `ingress-nginx` on the cluster with:

```bash
helm install <your-nginx-ingress-name-here> ingress-nginx/ingress-nginx --namespace=binderhub -f your-ingress-nginx-config-here.yaml
```

This will take a few moments. Note that you can name your ingress-nginx installation anything you want, but consider a descriptive name like "binderhub-ingress-nginx". Also, be sure to apply a custom configuration with the `-f` flag as in the example above. Minimally, your config file should include a definition for the load balancer IP.

See the "ingress-nginx.yaml" example file included in the same directory as this guide.

To check on the status of the ingress-nginx controller, you can run the following command:

```bash
kubectl get svc --namespace=binderhub
```

You should see something like the following:

```bash
NAME                                                 TYPE           CLUSTER-IP   EXTERNAL-IP     PORT(S)                      AGE
binderhub-ingress-nginx-controller             LoadBalancer   10.4.7.240   35.188.33.138   80:32402/TCP,443:32177/TCP   9d
```

If the `EXTERNAL-IP` column is empty, give the load balancer a few more moments to initialize. If it remains empty, you may have forgotten to specify a load balancer IP, or the IP may be unavailable. It should be the IP adress we reserved earlier.

### Optional: Add a Config Map for the NGINX Proxy

It's likely that you will want to specify some non-default configurations for the nginx proxy. To do this, you simply need to add a [configmap](https://kubernetes.io/docs/concepts/configuration/configmap/) resource:

```bash
kubectl apply -f your-nginx-configmap.yaml
```

An example has been included in the same directory as this guide.

## Install Binderhub

Now that we have installed the NGINX controller, we can install the binderhub helm chart. First, let's make sure we have access to it. Add the helm repo if you don't have it already:

```bash
helm repo add jupyterhub https://jupyterhub.github.io/helm-chart
```

Also, be sure to update your helm repos:

```bash
helm repo update
```

Finally, let's install Binderhub. Note that we specify a few special flags in the install command: `--version` and `-f`.

```bash
helm install <your-binderhub-name-here> jupyterhub/binderhub --version=1.0.0-0.dev.git.3128.h52ffd88 --namespace=binderhub -f config-stg.yaml
```

It may take a few moments for this command to complete.

You can find a list of Binderhub releases [here](https://hub.jupyter.org/helm-chart/#development-releases-binderhub). Simply copy the version you want to install, e.g. "1.0.0-0.dev.git.3128.h52ffd88", which is the version we use in the example command.

`-f` lets us specify configuration values via a yaml file. In the example, we use a file named "config-stg.yaml". See the example file of the same name in the same folder as this guide.

## Verify SSL Certs are Created

At this point, our cluster issuer should have ordered two SSL certificates for us, one for BinderHub and one for JupyterHub. To see a list of certificate resources generated for the cluster, you can run the following command:

```bash
kubectl describe certificate --namespace binderhub
```

Once you've verified the certificate has been issued successfully, you can try connecting to your BinderHub server! In your browser, enter the fully qualified domain name you chose for the server. It should look something like: `https://your.domain.name`.

Don't worry if your browser is complaining that the site is unsecure! Recall that we setup the cluster issuer with development values, so this is expected behavior. If you're able to open the web page at all, you have been successful so far.

Finally, let's update our cluster issuer with production values so the web browser won't complain about the certificates anymore.

First, create a new cluster issuer:

```bash
kubectl apply -f cluster-issuer-prod.yaml --namespace=binderhub
```

Notice the file "cluster-issuer-prod.yaml". See the file of the same name in the directory this guide is located in.

Then, upgrade our BinderHub deployment to use this new cluster issuer:

```bash
helm upgrade ***ARANGO_DB_NAME***-binderhub jupyterhub/binderhub --version=1.0.0-0.dev.git.3128.h52ffd88 --namespace=***ARANGO_DB_NAME***-binderhub -f config-prod.yaml
```

Congratulations! Your BinderHub deployment is complete! Verify the production certificates are indeed working by returning to your BinderHub in a web browser. Also, try creating a notebook with your favorite Github repository. If you are eventually redirected to the JupyterHub page, you've successfully deployed BinderHub!

## Additional Configurations

At the beginning of the guide, it was mentioned that the suggested config files include values to enable user authentication using Google OAuth. You can find the original instructions on how to configure Google OAuth on BinderHub [here](https://z2jh.jupyter.org/en/stable/administrator/authentication.html#google), and the companion instructions for JupyerHub [here](https://binderhub.readthedocs.io/en/latest/authentication.html#enabling-authentication).

It is VERY IMPORTANT that both of these guides are followed! Implementing just one or the other will result in unexpected behavior.

You may also find useful the following resources:

- [BinderHub Docs](https://binderhub.readthedocs.io/en/latest/index.html)
- [JupyterHub Docs](https://z2jh.jupyter.org/en/stable/#)
