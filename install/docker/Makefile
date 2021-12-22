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
.PHONY: help up status ps logs restart stop down clean reset exec test
# -----------------------------------------------------------------------------


# Targets ---------------------------------------------------------------------

help: ##@other Show this help.
	@perl -e '$(HELP_FUN)' $(MAKEFILE_LIST)

up: ## Build and run all (or some) containers in development mode. [c=<names>]
	@echo "\nBuilding and running containers...\nThis may take a while if running for the first time. \n"
	@${COMPOSE_COMMAND} up -d --build --quiet-pull --wait ${c} $(ARGS)
	@echo "\nTo access Lifelike, point your browser at: http://localhost:4200\n"

status: ## Show container(s) status. [c=<names>]
	@${COMPOSE_COMMAND} ${COMPOSE_FILES} ps ${c} ${ARGS}

ps: status

logs: ## Show container(s) logs. [c=<names>]
	@${COMPOSE_COMMAND} logs -f ${c} $(ARGS)

restart: ## Restart some or all container. [c=<names>]
	@${COMPOSE_COMMAND} restart ${c} $(ARGS)

stop: ## Stop some or all containers [c=<names>]
	@${COMPOSE_COMMAND} stop ${c} $(ARGS)

down: ## Destroy all containers and volumes
	@${COMPOSE_COMMAND} down --volumes --remove-orphans ${ARGS}

clean: down

reset: down up ## Destroy and recreate all containers and volumes

exec: ## Execute a command inside a container. [c=<name>, cmd=<command>]. E.g. make exec c=appserver cmd="flask create-user"
	@${COMPOSE_COMMAND} exec ${ARGS} ${c} ${cmd}

test: ## Execute test suite
	@${COMPOSE_COMMAND} exec ${ARGS} appserver pytest --cov=neo4japp ${pytest_args}
