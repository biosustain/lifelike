DOCKER_DIR:=$(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))

# Base Docker Compose command --------------------------------------------------
#  docker-compose.yml           -> Base services containers
#  docker-compose.dev.yml       -> Override base services for local development
#  docker-compose.services.yml  -> Third party services (PostgreSQL, Neo4j, Elasticsearch, Redis)
COMPOSE_COMMAND=\
  docker compose -p ***ARANGO_DB_NAME*** \
  -f ${DOCKER_DIR}/docker-compose.yml \
  -f ${DOCKER_DIR}/docker-compose.dev.yml \
  -f ${DOCKER_DIR}/docker-compose.services.yml
# ------------------------------------------------------------------------------

.PHONY: up build status ps logs restart stop exec test down reset diagram

up: ##@docker Build and run container(s) for development. [c=<names>]
	@echo "\nBuilding and running containers...\nThis may take a while if running for the first time. \n"
	@${COMPOSE_COMMAND} ${args} up -d --build --quiet-pull --wait ${c}
	@echo "\nTo access Lifelike, point your browser at: http://localhost:8080\n"

build: ##@docker Build container(s) for development. [c=<names>]
	@${COMPOSE_COMMAND} ${args} build ${c}

status: ##@docker Show container(s) status. [c=<names>]
	@${COMPOSE_COMMAND} ${args} ps ${c}

ps: status

logs: ##@docker Show container(s) logs. [c=<names>]
	@${COMPOSE_COMMAND} ${args} logs -f ${c}

restart: ##@docker Restart container(s). [c=<names>]
	@${COMPOSE_COMMAND} ${args} restart ${c}

stop: ##@docker Stop containers(s). [c=<names>]
	@${COMPOSE_COMMAND} ${args} stop ${c}

exec: ##@docker Execute a command inside a container. [c=<name>, cmd=<command>]
	@${COMPOSE_COMMAND} ${args} exec ${c} ${cmd}

test: ##@docker Execute test suite
	@${COMPOSE_COMMAND} ${args} exec appserver pytest --cov=neo4japp ${pytest_args}

down: ##@docker Destroy all containers and volumes
	@${COMPOSE_COMMAND} ${args} down --volumes --remove-orphans

reset: down up ##@docker Destroy and recreate all containers and volumes

diagram: ##@docker Generate an architecture diagram from the Docker Compose files
	@echo "Writing diagram to ${DOCKER_DIR}/diagram.svg"
	@${COMPOSE_COMMAND} config | \
	  echo "version: '3.9'\n$$(cat -)" | \
	  docker run --rm -i funkwerk/compose_plantuml --link-graph --notes --group | \
	  docker run --rm -i think/plantuml > ${DOCKER_DIR}/diagram.svg
