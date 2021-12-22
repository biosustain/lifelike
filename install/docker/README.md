# Getting Started with Lifelike using Docker

Docker is an easy way to get started with Lifelike.

## Prerequisites

- Docker [link](https://www.docker.com/get-started)

## Run locally with Docker Compose

In order to build and bring up all required containers, run the following command after cloning this repository:

Once it's running, you can access the Lifelike UI at [http://localhost:4242](http://localhost:4242) in your browser. Default username / password is: `admin@example.com` / `password`

```bash
make up
```

Output will be something like:

```
Building and running containers...
This may take a while if running for the first time.

[+] Running 9/9
 ⠿ Container ***ARANGO_DB_NAME***-postgres-1                Started                                                                                          3.6s
 ⠿ Container ***ARANGO_DB_NAME***-webserver-1               Started                                                                                          3.5s
 ⠿ Container ***ARANGO_DB_NAME***-neo4j-1                   Started                                                                                          3.2s
 ⠿ Container ***ARANGO_DB_NAME***-elasticsearch-1           Started                                                                                          3.5s
 ⠿ Container ***ARANGO_DB_NAME***-redis-1                   Started                                                                                          3.5s
 ⠿ Container ***ARANGO_DB_NAME***-pdfparser-1               Started                                                                                          3.3s
 ⠿ Container ***ARANGO_DB_NAME***-statistical-enrichment-1  Started                                                                                        238.2s
 ⠿ Container ***ARANGO_DB_NAME***-cache-invalidator-1       Started                                                                                        237.2s
 ⠿ Container ***ARANGO_DB_NAME***-appserver-1               Started

 To access Lifelike, point your browser at: http://localhost:4200
```

You can see other available targets by running `make help`:

```shell
$ make help
usage: make [target]

options:
  up                     Build and run all (or some) containers in development mode. [c=<names>]
  status                 Show container(s) status. [c=<names>]
  logs                   Show container(s) logs. [c=<names>]
  restart                Restart some or all container. [c=<names>]
  stop                   Stop some or all containers [c=<names>]
  down                   Destroy all containers and volumes
  reset                  Destroy and recreate all containers and volumes
  exec                   Execute a command inside a container. [c=<name>, cmd=<command>]. E.g. make exec c=appserver cmd="flask create-user"
  test                   Execute test suite

other:
  help                   Show this help.
```

You can customize which containers are started by combining or overriding the following compose files. See [Makefile](Makefile) for more details.

    ├── docker-compose.yml           --> Base services containers
    ├── docker-compose.dev.yml       --> Override base services for local development \
    └── docker-compose.services.yml  --> Third party services (DB, Neo4j, Redis, etc)

