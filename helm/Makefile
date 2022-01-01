HELM_DIR:=$(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))

.PHONY: helm-lint helm-dependency-update helm-package


helm-lint: ##@helm Run helm lint on Lifelike chart
	helm lint ${HELM_DIR}/***ARANGO_DB_NAME*** --strict ${args}

helm-dependency-update: ##@helm Install or update chart dependencies
	helm dependency update ${HELM_DIR}/***ARANGO_DB_NAME*** ${args}

helm-package: ##@helm Generate Lifelike helm chart package
	helm package ${HELM_DIR}/***ARANGO_DB_NAME*** --dependency-update --destination ${HELM_DIR} ${args}
