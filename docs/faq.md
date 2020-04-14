# FAQ

## Table of Contents
- [FAQ](#faq)
  - [Table of Contents](#table-of-contents)
  - [How do I set up my developer environment?](#how-do-i-set-up-my-developer-environment)
  - [How do I connect to the neo4j container?](#how-do-i-connect-to-the-neo4j-container)
  - [How do I connect to the postgres container?](#how-do-i-connect-to-the-postgres-container)
  - [How do I debug a running application locally?](#how-do-i-debug-a-running-application-locally)
  - [How do I remote ssh into a running container?](#how-do-i-remote-ssh-into-a-running-container)
  - [How do I update database with new changes?](#how-do-i-update-database-with-new-changes)

## How do I set up my developer environment?
To run the application, first create the docker images

__Step 1__
```
docker-compose build --no-cache
```

__(Optional)__
To setup `node_modules` folder for local development, run the following command
```
docker-compose run client yarn install
```
We could have also used `yarn install` locally, but this poses an issue when we go and mount our volume on Docker if our operating system is not Linux (e.g. if we're using Windows or Mac). Our client container will end up using the incorrect binaries, so by installing through Docker, we ensure we get the correct binaries.

__Step 2__
Run the application suite through
```
docker-compose up -d
```

__Step 3__
Run the following to set up the Neo4J full text indexing
```
docker-compose exec appserver python db/neo4jsetup.py
```

__Other Notes__
1. Run `docker-compose down` to stop the application.
2. The PostgreSQL database is currently being seeded on start up (after `docker-compose up`) which means you may find the login credentials listed in [here](../appserver/fixtures/seed.json).

## How do I connect to the neo4j container?
```
docker-compose exec database cypher-shell -u neo4j
```

## How do I connect to the postgres container?
```
docker-compose exec pgdatabase psql -U postgres -h pgdatabase -d postgres
```

## How do I debug a running application locally?
This means the application is running and once you hit a certain line in the code
while going through the application UI, the code will break at that point.

To do this, first edit the `docker-compose.yml` file for the `appserver` service. Add the following:

```yml
stdin_open: true
tty: true
```
Next, add the following to the part of the code that you want to break at:

```python
import pdb
pdb.set_trace()
```

Restart the application with the following commands:

```bash
docker-compose down && docker-compose up -d
# seed if needed...
docker attach <service_name> # e.g n4j-appserver
```
To exit out of attach mode, can do either `Ctrl+C` to exit and kill the container. Or `Ctrl+P, Ctrl+Q` to detach without killing. It's also possible to add new breakpoints without stopping the container like that since our setup allows updates to the containers automatically.

## How do I remote ssh into a running container?
In rare occasions where you need to ssh into the container as root: `docker exec -u 0 -it <container_name> bash`.

If you need to edit a file for debugging:

```bash
apt-get update
apt-get install vim
```

## How do I update database with new changes?
Database migration workflow can be found [here](https://github.com/SBRG/kg-prototypes/blob/master/appserver/migrations/README.md)
