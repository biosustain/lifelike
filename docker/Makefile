ROOT_DIR:=$(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))

# Base docker compose command---------------------------------------------------
#  docker-compose.yml           -> Base services containers
#  docker-compose.dev.yml       -> Override base services for local development \
#  docker-compose.services.yml  -> Third party services (DB, Neo4j, Redis, etc)
COMPOSE_COMMAND=\
  docker compose -p ***ARANGO_DB_NAME*** \
  -f ${ROOT_DIR}/docker-compose.yml \
  -f ${ROOT_DIR}/docker-compose.dev.yml \
  -f ${ROOT_DIR}/docker-compose.services.yml
# ------------------------------------------------------------------------------


# Helpers ---------------------------------------------------------------------
GREEN  := $(shell tput -Txterm setaf 2)
WHITE  := $(shell tput -Txterm setaf 7)
YELLOW := $(shell tput -Txterm setaf 3)
RED := $(shell tput -Txterm setaf 1)
RESET  := $(shell tput -Txterm sgr0)
HELP_FUN = \
    %help; \
    while(<>) { push @{$$help{$$2 // 'options'}}, [$$1, $$3] if /^([a-zA-Z\-]+)\s*:.*\#\#(?:@([a-zA-Z\-]+))?\s(.*)$$/ }; \
    print "usage: make [target]\n\n"; \
    for (sort keys %help) { \
    print "${WHITE}$$_:${RESET}\n"; \
    for (@{$$help{$$_}}) { \
    $$sep = " " x (32 - length $$_->[0]); \
    print "  ${YELLOW}$$_->[0]${RESET}$$sep${GREEN}$$_->[1]${RESET}\n"; \
    }; \
    print "\n"; }

.DEFAULT_GOAL := help
.PHONY: help up build status ps logs restart stop down clean reset exec test
# -----------------------------------------------------------------------------


# Targets ---------------------------------------------------------------------

help: ##@other Show this help.
	@perl -e '$(HELP_FUN)' $(MAKEFILE_LIST)

up: ##@docker Build and run container(s) for development. [c=<names>]
	@echo "\nBuilding and running containers...\nThis may take a while if running for the first time. \n"
	${COMPOSE_COMMAND} $(ARGS) up -d --build --quiet-pull --wait ${c}
	@echo "\nTo access Lifelike, point your browser at: http://localhost:8080\n"

build: ##@docker Build container(s) for development. [c=<names>]
	${COMPOSE_COMMAND} $(ARGS) build ${c}

status: ##@docker Show container(s) status. [c=<names>]
	@${COMPOSE_COMMAND} ${ARGS} ps ${c}

ps: status

logs: ##@docker Show container(s) logs. [c=<names>]
	@${COMPOSE_COMMAND} $(ARGS) logs -f ${c}

restart: ##@docker Restart container(s). [c=<names>]
	@${COMPOSE_COMMAND} $(ARGS) restart ${c}

stop: ##@docker Stop containers(s). [c=<names>]
	@${COMPOSE_COMMAND} $(ARGS) stop ${c}

exec: ##@docker Execute a command inside a container. [c=<name>, cmd=<command>]
	@${COMPOSE_COMMAND} ${ARGS} exec ${c} ${cmd}

test: ##@docker Execute test suite
	@${COMPOSE_COMMAND} ${ARGS} exec appserver pytest --cov=neo4japp ${pytest_args}

down: ##@docker Destroy all containers and volumes
	@${COMPOSE_COMMAND} ${ARGS} down --volumes --remove-orphans

reset: down up ##@docker Destroy and recreate all containers and volumes

clean: down
