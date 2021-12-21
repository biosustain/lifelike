ROOT_DIR:=$(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))
COMPOSE_FILES=-f ${ROOT_DIR}/docker-compose.yml -f ${ROOT_DIR}/docker-compose.dev.yml -f ${ROOT_DIR}/docker-compose.services.yml

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
.PHONY: help up status ps logs stop down reset clean exec

help: ##@other Show this help.
	@perl -e '$(HELP_FUN)' $(MAKEFILE_LIST)

up: ## Start all or c=<name> containers in foreground
	@docker compose ${COMPOSE_FILES} up -d --build $(ARGS)

status: ## Show containers status
	@docker compose ${COMPOSE_FILES} ps ${ARGS}

ps: status

logs: ## Tail containers logs
	@docker compose ${COMPOSE_FILES} logs -f $(ARGS)

stop: ## Stop all containers
	@docker compose ${COMPOSE_FILES} stop $(ARGS)

down: ## Destroy all containers and volumes
	@docker compose ${COMPOSE_FILES} down --volumes --remove-orphans

clean: down

reset: down up ## Destroy and recreate all containers and volumes

exec: ## Execute a command inside a container
	@docker compose ${COMPOSE_FILES} exec ${ARGS}
