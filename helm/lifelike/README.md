# Lifelike Helm chart

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 0.9.6](https://img.shields.io/badge/AppVersion-0.9.6-informational?style=flat-square)

A Helm chart to deploy Lifelike in Kubernetes

## Requirements

Kubernetes: `>=1.20.0-0`

| Repository | Name | Version |
|------------|------|---------|
| https://charts.bitnami.com/bitnami | postgresql | 10.13.4 |
| https://charts.bitnami.com/bitnami | redis | 15.5.4 |
| https://helm.elastic.co | elasticsearch | 7.15.0 |
| https://neo4j-contrib.github.io/neo4j-helm | neo4j | 4.3.6 |

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| api.affinity | object | `{}` |  |
| api.autoScaling.enabled | bool | `false` | Enable or disable the API server autoscaling |
| api.autoScaling.maxReplicas | int | `4` |  |
| api.autoScaling.minReplicas | int | `2` |  |
| api.autoScaling.targetCPUUtilizationPercentage | int | `80` |  |
| api.autoScaling.targetMemoryUtilizationPercentage | int | `80` |  |
| api.dbWaiter.image.imagePullPolicy | string | `"IfNotPresent"` |  |
| api.dbWaiter.image.repository | string | `"willwill/wait-for-it"` |  |
| api.dbWaiter.image.tag | string | `"latest"` |  |
| api.dbWaiter.timeoutSeconds | int | `30` |  |
| api.defaultPodSecurityContext.enabled | bool | `true` |  |
| api.extraEnv | object | `{}` | Extra environment variables to pass to the API server |
| api.image.imagePullPolicy | string | `"IfNotPresent"` |  |
| api.image.imagePullSecrets[0].name | string | `"***ARANGO_DB_NAME***-registry"` |  |
| api.image.repository | string | `"***ARANGO_DB_NAME***.azurecr.io/kg-appserver"` |  |
| api.image.tag | string | `"latest"` |  |
| api.ingress.annotations | object | `{}` |  |
| api.ingress.enabled | bool | `false` |  |
| api.ingress.hosts[0].host | string | `"***ARANGO_DB_NAME***-api.local"` |  |
| api.ingress.hosts[0].paths | list | `[]` |  |
| api.ingress.tls | list | `[]` |  |
| api.livenessProbe.failureThreshold | int | `20` |  |
| api.livenessProbe.initialDelaySeconds | int | `20` |  |
| api.livenessProbe.path | string | `"/meta/"` |  |
| api.livenessProbe.periodSeconds | int | `10` |  |
| api.livenessProbe.successThreshold | int | `1` |  |
| api.livenessProbe.timeoutSeconds | int | `10` |  |
| api.nodeSelector | object | `{}` |  |
| api.podAnnotations | object | `{}` |  |
| api.podLabels | object | `{}` |  |
| api.podSecurityContext.fsGroup | int | `1000` |  |
| api.readinessProbe.failureThreshold | int | `20` |  |
| api.readinessProbe.initialDelaySeconds | int | `20` |  |
| api.readinessProbe.path | string | `"/meta/"` |  |
| api.readinessProbe.periodSeconds | int | `10` |  |
| api.readinessProbe.successThreshold | int | `1` |  |
| api.readinessProbe.timeoutSeconds | int | `10` |  |
| api.replicaCount | int | `1` | Number of replicas running for the API server |
| api.resources.requests.cpu | string | `"250m"` |  |
| api.resources.requests.memory | string | `"1600Mi"` |  |
| api.schedulerName | string | `nil` |  |
| api.service.port | int | `5000` |  |
| api.service.type | string | `"ClusterIP"` |  |
| api.strategyType | string | `"Recreate"` |  |
| api.tolerations | list | `[]` |  |
| elasticsearch.clusterHealthCheckParams | string | `"wait_for_status=yellow&timeout=1s"` | If replicas is 1, status stays in yellow, otherwise change to green |
| elasticsearch.enabled | bool | `true` | When enabled, a new Elasticsearch cluster will be deployed using the official Helm chart |
| elasticsearch.esConfig | object | `{"elasticsearch.yml":"node.store.allow_mmap: false\n"}` | Elasticsearch confguration |
| elasticsearch.extraEnvs[0].name | string | `"ELASTIC_USERNAME"` |  |
| elasticsearch.extraEnvs[0].value | string | `"elastic"` |  |
| elasticsearch.extraEnvs[1].name | string | `"ELASTIC_PASSWORD"` |  |
| elasticsearch.extraEnvs[1].value | string | `"password"` |  |
| elasticsearch.extraInitContainers | list | `[{"command":["sh","-c","bin/elasticsearch-plugin install --batch ingest-attachment\n"],"image":"docker.elastic.co/elasticsearch/elasticsearch:7.15.0","name":"install-plugins"}]` | Extra init containers to install plugins |
| elasticsearch.replicas | int | `1` | Number of replicas for the Elasticsearch cluster |
| elasticsearch.volumeClaimTemplate | object | `{"resources":{"requests":{"storage":"10Gi"}}}` | Persistent storage for Elasticsearch nodes |
| elasticsearchExternal | object | `{"host":"elasticsearch.local","password":"","port":9200,"user":""}` | When elasticsearch.enabled is false, this Elsaicsearch configuration will be used |
| frontend.affinity | object | `{}` |  |
| frontend.apiProxy.enabled | bool | `false` |  |
| frontend.autoScaling.enabled | bool | `false` | Enable or disable the API server autoscaling |
| frontend.autoScaling.maxReplicas | int | `4` |  |
| frontend.autoScaling.minReplicas | int | `2` |  |
| frontend.autoScaling.targetCPUUtilizationPercentage | int | `80` |  |
| frontend.autoScaling.targetMemoryUtilizationPercentage | int | `80` |  |
| frontend.defaultPodSecurityContext.enabled | bool | `true` |  |
| frontend.extraEnv | object | `{}` |  |
| frontend.frontend.ingress.annotations."cert-manager.io/cluster-issuer" | string | `"letsencrypt"` |  |
| frontend.frontend.ingress.annotations."kubernetes.io/ingress.class" | string | `"nginx"` |  |
| frontend.frontend.ingress.annotations."nginx.ingress.kubernetes.io/service-upstream" | string | `"true"` |  |
| frontend.frontend.ingress.enabled | bool | `false` |  |
| frontend.frontend.ingress.hosts[0] | object | `{"host":"***ARANGO_DB_NAME***.local","paths":[{"path":"/","pathType":"Prefix"}]}` | Ingress hostname |
| frontend.frontend.ingress.tls[0].hosts[0] | string | `"***ARANGO_DB_NAME***.local"` |  |
| frontend.frontend.ingress.tls[0].secretName | string | `"***ARANGO_DB_NAME***-tls"` |  |
| frontend.image.imagePullPolicy | string | `"IfNotPresent"` |  |
| frontend.image.imagePullSecrets[0].name | string | `"***ARANGO_DB_NAME***-registry"` |  |
| frontend.image.repository | string | `"***ARANGO_DB_NAME***.azurecr.io/kg-webserver"` |  |
| frontend.image.tag | string | `"latest"` |  |
| frontend.livenessProbe.failureThreshold | int | `20` |  |
| frontend.livenessProbe.initialDelaySeconds | int | `20` |  |
| frontend.livenessProbe.periodSeconds | int | `10` |  |
| frontend.livenessProbe.successThreshold | int | `1` |  |
| frontend.livenessProbe.timeoutSeconds | int | `10` |  |
| frontend.nodeSelector | object | `{}` |  |
| frontend.podAnnotations | object | `{}` |  |
| frontend.podLabels | object | `{}` |  |
| frontend.podSecurityContext | object | `{}` |  |
| frontend.readinessProbe.failureThreshold | int | `20` |  |
| frontend.readinessProbe.initialDelaySeconds | int | `20` |  |
| frontend.readinessProbe.periodSeconds | int | `10` |  |
| frontend.readinessProbe.successThreshold | int | `1` |  |
| frontend.readinessProbe.timeoutSeconds | int | `10` |  |
| frontend.replicaCount | int | `1` |  |
| frontend.resources | object | `{}` |  |
| frontend.service.port | int | `80` |  |
| frontend.service.type | string | `"ClusterIP"` |  |
| frontend.tolerations | list | `[]` |  |
| fullnameOverride | string | `""` |  |
| global | object | `{}` |  |
| logstash.extraEnvs[0].name | string | `"ELASTIC_USERNAME"` |  |
| logstash.extraEnvs[0].valueFrom.secretKeyRef.key | string | `"username"` |  |
| logstash.extraEnvs[0].valueFrom.secretKeyRef.name | string | `"elasticsearch-master-credentials"` |  |
| logstash.extraEnvs[1].name | string | `"ELASTIC_PASSWORD"` |  |
| logstash.extraEnvs[1].valueFrom.secretKeyRef.key | string | `"password"` |  |
| logstash.extraEnvs[1].valueFrom.secretKeyRef.name | string | `"elasticsearch-master-credentials"` |  |
| logstash.logstashConfig."logstash.yml" | string | `"http.host: 0.0.0.0\nxpack.monitoring.enabled: false\n"` |  |
| logstash.logstashPipeline."uptime.conf" | string | `"input { exec { command => \"uptime\" interval => 30 } }\noutput {\n  elasticsearch {\n    hosts => [\"http://elasticsearch-master:9200\"]\n    user => '${ELASTIC_USERNAME}'\n    password => '${ELASTIC_PASSWORD}'\n    index => \"annotations\"\n  }\n}\n"` |  |
| logstash.persistence.enabled | bool | `true` |  |
| nameOverride | string | `""` |  |
| neo4j.acceptLicenseAgreement | string | `"yes"` |  |
| neo4j.core.numberOfServers | int | `1` |  |
| neo4j.core.persistentVolume.size | string | `"5Gi"` | Size of the persistent volume for each server |
| neo4j.core.standalone | bool | `true` | Whether to deploy a santalone server or a replicated cluster |
| neo4j.enabled | bool | `true` | Whether to automatically deploy a new Neo4j cluter |
| neo4j.neo4jPassword | string | `"password"` | Neo4j password |
| neo4jExternal.host | string | `"neo4j.local"` |  |
| neo4jExternal.password | string | `"password"` |  |
| neo4jExternal.port | int | `7474` |  |
| neo4jExternal.user | string | `"neo4j"` |  |
| pdfparser.affinity | object | `{}` |  |
| pdfparser.autoScaling.enabled | bool | `false` | Enable or disable the API server autoscaling |
| pdfparser.autoScaling.maxReplicas | int | `4` |  |
| pdfparser.autoScaling.minReplicas | int | `2` |  |
| pdfparser.autoScaling.targetCPUUtilizationPercentage | int | `80` |  |
| pdfparser.autoScaling.targetMemoryUtilizationPercentage | int | `80` |  |
| pdfparser.defaultPodSecurityContext.enabled | bool | `true` |  |
| pdfparser.extraEnv | object | `{}` |  |
| pdfparser.image.imagePullPolicy | string | `"IfNotPresent"` |  |
| pdfparser.image.imagePullSecrets[0].name | string | `"***ARANGO_DB_NAME***-registry"` |  |
| pdfparser.image.repository | string | `"***ARANGO_DB_NAME***.azurecr.io/kg-pdfparser"` |  |
| pdfparser.image.tag | string | `"latest"` |  |
| pdfparser.livenessProbe.failureThreshold | int | `20` |  |
| pdfparser.livenessProbe.initialDelaySeconds | int | `20` |  |
| pdfparser.livenessProbe.periodSeconds | int | `10` |  |
| pdfparser.livenessProbe.successThreshold | int | `1` |  |
| pdfparser.livenessProbe.timeoutSeconds | int | `10` |  |
| pdfparser.nodeSelector | object | `{}` |  |
| pdfparser.podAnnotations | object | `{}` |  |
| pdfparser.podLabels | object | `{}` |  |
| pdfparser.podSecurityContext | object | `{}` |  |
| pdfparser.readinessProbe.failureThreshold | int | `20` |  |
| pdfparser.readinessProbe.initialDelaySeconds | int | `20` |  |
| pdfparser.readinessProbe.periodSeconds | int | `10` |  |
| pdfparser.readinessProbe.successThreshold | int | `1` |  |
| pdfparser.readinessProbe.timeoutSeconds | int | `10` |  |
| pdfparser.replicaCount | int | `1` | Number of replicas running for the API server |
| pdfparser.resources | object | `{}` |  |
| pdfparser.schedulerName | string | `nil` |  |
| pdfparser.service.port | int | `7600` |  |
| pdfparser.service.type | string | `"ClusterIP"` |  |
| pdfparser.tolerations | list | `[]` |  |
| postgresql.enabled | bool | `true` | Whether to automatically deploy a new PostgreSQL database |
| postgresql.postgresqlDatabase | string | `"***ARANGO_DB_NAME***"` |  |
| postgresql.postgresqlPassword | string | `"***ARANGO_DB_NAME***"` |  |
| postgresql.postgresqlUsername | string | `"***ARANGO_DB_NAME***"` |  |
| postgresql.serviceAccount.enabled | bool | `true` |  |
| postgresqlExternal | object | `{"database":"***ARANGO_DB_NAME***","host":"postgres.local","password":"password","port":5432,"user":"postgres"}` | Optionally, bring your own PostgreSQL |
| redis.architecture | string | `"standalone"` | Allowed values: `standalone` or `replication` |
| redis.auth.password | string | `"password"` |  |
| redis.commonConfiguration | string | `"# Disable persistence\nsave \"\"\n# Disable AOF https://redis.io/topics/persistence#append-only-file\nappendonly no"` | Redis configuration as a fast cache |
| redis.enabled | bool | `true` | When enabled, a new Redis cluster will be deployed using the Bitnami Helm chart |
| redis.master.extraFlags[0] | string | `"--maxmemory-policy allkeys-lru"` |  |
| redis.master.persistence | object | `{"enabled":false}` | As we use Redis as a cache, we don't need persistence |
| redis.replica.extraFlags[0] | string | `"--maxmemory-policy allkeys-lru"` |  |
| redis.replica.persistence.enabled | bool | `false` |  |
| redisExternal | object | `{"host":"redis.local","password":"","port":6379}` | When redis.enabled is false, this Redis configuration will be used |
| serviceAccount.annotations | object | `{}` |  |
| serviceAccount.create | bool | `true` |  |
| serviceAccount.name | string | `""` |  |
| statisticalEnrichment.affinity | object | `{}` |  |
| statisticalEnrichment.defaultPodSecurityContext.enabled | bool | `true` |  |
| statisticalEnrichment.extraEnv | object | `{}` |  |
| statisticalEnrichment.image.imagePullPolicy | string | `"IfNotPresent"` |  |
| statisticalEnrichment.image.imagePullSecrets[0].name | string | `"***ARANGO_DB_NAME***-registry"` |  |
| statisticalEnrichment.image.repository | string | `"***ARANGO_DB_NAME***.azurecr.io/kg-statistical-enrichment"` |  |
| statisticalEnrichment.image.tag | string | `"latest"` |  |
| statisticalEnrichment.livenessProbe.failureThreshold | int | `20` |  |
| statisticalEnrichment.livenessProbe.initialDelaySeconds | int | `20` |  |
| statisticalEnrichment.livenessProbe.periodSeconds | int | `10` |  |
| statisticalEnrichment.livenessProbe.successThreshold | int | `1` |  |
| statisticalEnrichment.livenessProbe.timeoutSeconds | int | `10` |  |
| statisticalEnrichment.nodeSelector | object | `{}` |  |
| statisticalEnrichment.podAnnotations | object | `{}` |  |
| statisticalEnrichment.podLabels | object | `{}` |  |
| statisticalEnrichment.podSecurityContext | object | `{}` |  |
| statisticalEnrichment.readinessProbe.failureThreshold | int | `20` |  |
| statisticalEnrichment.readinessProbe.initialDelaySeconds | int | `20` |  |
| statisticalEnrichment.readinessProbe.periodSeconds | int | `10` |  |
| statisticalEnrichment.readinessProbe.successThreshold | int | `1` |  |
| statisticalEnrichment.readinessProbe.timeoutSeconds | int | `10` |  |
| statisticalEnrichment.replicaCount | int | `1` |  |
| statisticalEnrichment.resources | object | `{}` |  |
| statisticalEnrichment.service.port | int | `7600` |  |
| statisticalEnrichment.service.type | string | `"ClusterIP"` |  |
| statisticalEnrichment.tolerations | list | `[]` |  |

----------------------------------------------
Autogenerated from chart metadata using [helm-docs v1.5.0](https://github.com/norwoodj/helm-docs/releases/v1.5.0)
