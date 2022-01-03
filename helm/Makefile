HELM_DIR:=$(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))

.PHONY: helm-lint helm-dependency-update helm-schema-gen helm-docs helm-package helm-install helm-install-single-node


helm-lint: ##@helm Run helm lint on Lifelike chart
	helm lint ${HELM_DIR}/***ARANGO_DB_NAME*** --strict ${args}

helm-dependency-update: ##@helm Install or update chart dependencies
	helm dependency update ${HELM_DIR}/***ARANGO_DB_NAME*** ${args}

helm-schema-gen: ##@helm Generate Helm chart values JSON schema
	helm schema-gen ${HELM_DIR}/***ARANGO_DB_NAME***/values.yaml > ${HELM_DIR}/***ARANGO_DB_NAME***/values.schema.json

helm-docs: ##@helm Generate Helm chart README docs
	helm-docs -c ${HELM_DIR}/***ARANGO_DB_NAME*** -s file

helm-package: ##@helm Generate Lifelike helm chart package
	helm package ${HELM_DIR}/***ARANGO_DB_NAME*** --dependency-update --destination ${HELM_DIR} ${args}

helm-install: ##@helm Install or upgrade Lifelike chart
	helm upgrade \
      --install \
      --namespace ***ARANGO_DB_NAME*** \
      --create-namespace \
      ***ARANGO_DB_NAME*** \
      ${HELM_DIR}/***ARANGO_DB_NAME*** \
      ${args}

helm-install-single-node: args:=--values ${HELM_DIR}/***ARANGO_DB_NAME***/examples/single-node.yaml
helm-install-single-node: helm-install ##@helm Install or upgrade Lifelike chart using the single-node example values
