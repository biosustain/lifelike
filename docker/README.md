# Getting Started with Lifelike using Docker

Docker is an easy way to get started with Lifelike.

## Prerequisites

- Docker [link](https://www.docker.com/get-started)

## Run locally with Docker Compose

In order to build and bring up all required containers, run the following command after cloning this repository:

Once it's running, you can access the Lifelike UI at [http://localhost:8080](http://localhost:8080) in your browser. Default username / password is: `admin@example.com` / `password`

```shell
make up
```

Output will be something like:

```text
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

docker:
  up                              Build and run container(s) for development. [c=<names>]
  build                           Build container(s) for development. [c=<names>]
  status                          Show container(s) status. [c=<names>]
  logs                            Show container(s) logs. [c=<names>]
  restart                         Restart container(s). [c=<names>]
  stop                            Stop containers(s). [c=<names>]
  exec                            Execute a command inside a container. [c=<name>, cmd=<command>]
  test                            Execute test suite
  down                            Destroy all containers and volumes
  reset                           Destroy and recreate all containers and volumes

other:
  help                            Show this help.
```

You can customize which containers are started by combining or overriding the following Compose files. See [Makefile](Makefile) for more details.

```tree
├── docker-compose.yml           --> Base services
├── docker-compose.dev.yml       --> Override base services for local development
└── docker-compose.services.yml  --> Third party services (PostgreSQL, Neo4j, Redis, etc)
```
