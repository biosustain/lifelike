# Generate SSL Certs for Lifelike on Contabo

Currently the deployment *does not* automatically check for the existence of the SSL certs for Lifelike and the accessory services. This document will walk through the post-deployment steps required to generate the certs and configure the VM to automatically renew them.

## Generate the Certificates

The Lifelike application and any other services requiring SSL certs should already be configured to use them. They just need to be generated manually.

### Generate Certs for Lifelike

To generate certificates for the main ***ARANGO_DB_NAME*** application, there are a number of steps required after the first deployment. Because we need a running server for Let's Encrypt to actually generate the certs, we need to start the proxy. However, the proxy currently assumes that the certs *already exist*. So, we need to temporarily update the proxy config so that we can generate the certs.

In the `/home/ansible/nginx/conf` folder, add the file `default.conf`. If it already exists, create a backup file first with `cp default.conf default.conf.bak`. Then, replace the entire file with the following:

```conf
log_format upstream_logging '[$time_local] $remote_addr - $remote_user - $server_name to: $upstream_addr: $request $upstream_cache_status upstream_response_time $upstream_response_time msec $msec request_time $request_time';

##### Start Webserver Block #####

# HTTP server to redirect all 80 traffic to SSL/HTTPS
server {
    listen 80;
    server_name <webserver-domain-name>;

    location /.well-known/acme-challenge/ {
        ***ARANGO_USERNAME*** /var/www/certbot;
    }

    # Redirect the request to HTTPS
    location / {
        return 301 https://<webserver-domain-name>$request_uri;
    }
}

# ##### Start JupyterHub Block #####

# # HTTP server to redirect all 80 traffic to SSL/HTTPS
server {
    listen 80;
    server_name <jupyterhub-domain-name>;

    location /.well-known/acme-challenge/ {
        ***ARANGO_USERNAME*** /var/www/certbot;
    }

    location / {
        return 301 https://<jupyterhub-domain-name>$request_uri;
    }
}
```

Notice the actual server names are left for you to add!

Restart the containers, and once the proxy is started successfully, run the following command:

`docker-compose -f <docker-compose.yml file> run --rm  certbot certonly --web***ARANGO_USERNAME*** --web***ARANGO_USERNAME***-path /var/www/certbot/ --dry-run -d <***ARANGO_DB_NAME***-contabo-domain-name>`

This will begin a dry-run of the certificate generation process, and if it succeeds, you can run it again without the `--dry-run` flag to generate the actual certs:

`docker-compose -f <docker-compose.yml file> run --rm  certbot certonly --web***ARANGO_USERNAME*** --web***ARANGO_USERNAME***-path /var/www/certbot/ -d <***ARANGO_DB_NAME***-contabo-domain-name>`

Repeat this process for the JupyterHub domain name. You can also streamline these steps by providing additional `-d` options to the commands above, e.g.:

`docker-compose -f <docker-compose.yml file> run --rm  certbot certonly --web***ARANGO_USERNAME*** --web***ARANGO_USERNAME***-path /var/www/certbot/ --dry-run -d <***ARANGO_DB_NAME***-contabo-domain-name> -d <jupyterhub-contabo-domain-name>`

Finally, stop the proxy container and remove the `/home/ansible/nginx/conf/default.conf` file.

## Automatically Renew Certificates

We can easily renew all of our certificates automatically by setting up a cron job to do it for us. Open the cron editor with:

`crontab -e`

Then, add the following entry:

`0 0 * * * docker-compose -f /home/ansible/docker-compose.contabo.yml run --rm certbot renew`
