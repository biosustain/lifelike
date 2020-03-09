# FAQ

## Table of Contents
- [How do I connect to the postgres container?](#how-do-I-connect-to-the-postgres-container)
- [How do I debug a running application locally?](#how-do-I-debug-a-running-application-locally)
- [How do I remote ssh into a running container?](#how-do-I-remote-ssh-into-a-running-container)
- [How do I update database with new changes?](#how-do-I-update-database-with-new-changes)

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
In rare occasions where you need to ssh into the container as ***ARANGO_USERNAME***: `docker exec -u 0 -it <container_name> bash`.

If you need to edit a file for debugging:

```bash
apt-get update
apt-get install vim
```

## How do I update database with new changes?
Database migration workflow can be found [here](https://github.com/SBRG/kg-prototypes/blob/master/appserver/migrations/README.md)
