# ***ARANGO_DB_NAME***

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: latest](https://img.shields.io/badge/AppVersion-latest-informational?style=flat-square)

A Helm chart to deploy Lifelike in Kubernetes. Turning big data into contextualized knowledge

**Homepage:** <https://www.***ARANGO_DB_NAME***.bio>

## Source Code

* <https://github.com/SBRG/***ARANGO_DB_NAME***>

## Requirements

Kubernetes: `>=1.20.0-0`

| Repository | Name | Version |
|------------|------|---------|
| https://charts.bitnami.com/bitnami | postgresql | 10.14.0 |
| https://charts.bitnami.com/bitnami | redis | 15.6.9 |
| https://helm.elastic.co | elasticsearch | 7.16.2 |
| https://neo4j-contrib.github.io/neo4j-helm | neo4j | 4.4.1 |

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| global | object | `{}` |  |
| nameOverride | string | `""` |  |
| fullnameOverride | string | `""` |  |
| ingress.enabled | bool | `false` |  |
| ingress.hostname | string | `"***ARANGO_DB_NAME***.local"` |  |
| ingress.className | string | `""` |  |
| ingress.annotations | object | `{}` |  |
| ingress.tls | list | `[]` |  |
| api.image.repository | string | `"us.gcr.io/able-goods-221820/***ARANGO_DB_NAME***-appserver"` |  |
| api.image.tag | string | `""` |  |
| api.secret | string | `"secret"` |  |
| api.extraEnv | object | `{"INITIAL_ADMIN_EMAIL":"admin@example.com"}` | Extra environment variables to pass to the appserver |
| api.replicaCount | int | `1` | Number of replicas running the appserver |
| api.autoScaling.enabled | bool | `false` | If enabled, value at api.replicaCount will be ignored |
| api.autoScaling.minReplicas | int | `2` |  |
| api.autoScaling.maxReplicas | int | `4` |  |
| api.autoScaling.targetCPUUtilizationPercentage | int | `80` |  |
| api.autoScaling.targetMemoryUtilizationPercentage | int | `80` |  |
| api.strategyType | string | `"RollingUpdate"` | if using some PV that does not support readWriteMany, set this to 'Recreate' |
| api.lmdb.loadEnabled | bool | `false` |  |
| api.service.type | string | `"ClusterIP"` |  |
| api.service.port | int | `5000` |  |
| api.resources | object | `{}` |  |
| api.livenessProbe.enabled | bool | `true` | Set to false to disable liveness probes |
| api.livenessProbe.path | string | `"/meta"` |  |
| api.readinessProbe.enabled | bool | `true` | Set to false to disable readiness probes |
| api.readinessProbe.path | string | `"/meta"` |  |
| api.extraVolumes | list | `[]` |  |
| api.extraVolumeMounts | list | `[]` |  |
| api.dbWaiter.image.repository | string | `"willwill/wait-for-it"` |  |
| api.dbWaiter.image.tag | string | `"latest"` |  |
| api.dbWaiter.image.imagePullPolicy | string | `"IfNotPresent"` |  |
| api.dbWaiter.timeoutSeconds | int | `30` |  |
| frontend.image.repository | string | `"us.gcr.io/able-goods-221820/***ARANGO_DB_NAME***-frontend"` |  |
| frontend.image.tag | string | `""` |  |
| frontend.replicaCount | int | `1` |  |
| frontend.autoScaling.enabled | bool | `false` |  |
| frontend.autoScaling.minReplicas | int | `2` |  |
| frontend.autoScaling.maxReplicas | int | `5` |  |
| frontend.autoScaling.targetCPUUtilizationPercentage | int | `80` |  |
| frontend.autoScaling.targetMemoryUtilizationPercentage | int | `80` |  |
| frontend.service.type | string | `"ClusterIP"` |  |
| frontend.service.port | int | `80` |  |
| frontend.livenessProbe.enabled | bool | `true` | Set to false to disable liveness probes |
| frontend.livenessProbe.path | string | `"/"` |  |
| frontend.readinessProbe.enabled | bool | `true` |  |
| frontend.readinessProbe.path | string | `"/"` |  |
| pdfparser.image.repository | string | `"us.gcr.io/able-goods-221820/***ARANGO_DB_NAME***-pdfparser"` |  |
| pdfparser.image.tag | string | `"latest"` |  |
| pdfparser.replicaCount | int | `1` | Number of replicas running, ignored if autoScaling is enabled |
| pdfparser.autoScaling | object | `{"enabled":false,"maxReplicas":4,"minReplicas":2,"targetCPUUtilizationPercentage":80,"targetMemoryUtilizationPercentage":80}` | Horizontal pod autoscaler configuration |
| pdfparser.autoScaling.enabled | bool | `false` | Set to true to enable autoscaling, ignoring pdfparser.replicaCount |
| pdfparser.service.type | string | `"ClusterIP"` |  |
| pdfparser.service.port | int | `7600` |  |
| pdfparser.livenessProbe.enabled | bool | `true` | Set to false to disable liveness probes |
| pdfparser.livenessProbe.path | string | `"/"` |  |
| pdfparser.readinessProbe.enabled | bool | `true` |  |
| pdfparser.readinessProbe.path | string | `"/"` |  |
| statisticalEnrichment.image.repository | string | `"us.gcr.io/able-goods-221820/***ARANGO_DB_NAME***-statistical-enrichment"` |  |
| statisticalEnrichment.image.tag | string | `""` |  |
| statisticalEnrichment.replicaCount | int | `1` |  |
| statisticalEnrichment.service.type | string | `"ClusterIP"` |  |
| statisticalEnrichment.service.port | int | `5000` |  |
| statisticalEnrichment.livenessProbe.enabled | bool | `true` | Set to false to disable liveness probes |
| statisticalEnrichment.livenessProbe.path | string | `"/healthz"` |  |
| statisticalEnrichment.readinessProbe.enabled | bool | `true` | Set to false to disable readiness probes |
| statisticalEnrichment.readinessProbe.path | string | `"/healthz"` |  |
| statisticalEnrichment.resources | object | `{}` |  |
| worker.image.repository | string | `"us.gcr.io/able-goods-221820/***ARANGO_DB_NAME***-worker"` |  |
| worker.image.tag | string | `""` |  |
| worker.replicaCount | int | `1` | Number of running replicas, ignored if autoScaling is enabled |
| worker.autoScaling | object | `{"enabled":false,"maxReplicas":4,"minReplicas":2,"targetCPUUtilizationPercentage":80,"targetMemoryUtilizationPercentage":80}` | Horizontal pod autoscaler configuration |
| worker.autoScaling.enabled | bool | `false` | Set to true to enable autoscaling, ignoring pdfparser.replicaCount |
| postgresqlExternal.host | string | `"postgres.local"` |  |
| postgresqlExternal.port | int | `5432` |  |
| postgresqlExternal.user | string | `"postgres"` |  |
| postgresqlExternal.database | string | `"postgres"` |  |
| postgresqlExternal.password | string | `"password"` |  |
| postgresqlExternal.existingSecret | string | `""` |  |
| neo4jExternal.host | string | `"neo4j.local"` |  |
| neo4jExternal.port | int | `7687` |  |
| neo4jExternal.user | string | `"neo4j"` |  |
| neo4jExternal.password | string | `"password"` |  |
| neo4jExternal.database | string | `"neo4j"` |  |
| redisExternal.host | string | `"redis.local"` |  |
| redisExternal.port | int | `6379` |  |
| redisExternal.password | string | `""` |  |
| elasticsearchExternal.host | string | `"elasticsearch.local"` |  |
| elasticsearchExternal.port | int | `9200` |  |
| elasticsearchExternal.user | string | `""` |  |
| elasticsearchExternal.password | string | `""` |  |
| elasticsearchExternal.ssl | bool | `false` |  |
| postgresql.enabled | bool | `true` | Set to false to disable automatic deployment of PostgreSQL |
| postgresql.postgresqlDatabase | string | `"postgres"` |  |
| postgresql.postgresqlPassword | string | `"password"` |  |
| neo4j.enabled | bool | `true` |  |
| neo4j.imageTag | string | `"4.4.1-community"` |  |
| neo4j.neo4jPassword | string | `"password"` |  |
| neo4j.core.standalone | bool | `true` |  |
| neo4j.core.numberOfServers | int | `1` |  |
| neo4j.core.persistentVolume.size | string | `"100Gi"` |  |
| elasticsearch.enabled | bool | `true` |  |
| elasticsearch.fullnameOverride | string | `"elasticsearch"` |  |
| elasticsearch.esConfig."elasticsearch.yml" | string | `"node.store.allow_mmap: false\n"` |  |
| elasticsearch.volumeClaimTemplate.resources.requests.storage | string | `"30Gi"` |  |
| redis.enabled | bool | `true` |  |
| redis.auth.password | string | `"password"` |  |
| redis.master.persistence.enabled | bool | `false` |  |
| redis.master.extraFlags[0] | string | `"--maxmemory-policy allkeys-lru"` |  |
| redis.replica.persistence.enabled | bool | `false` |  |
| redis.replica.extraFlags[0] | string | `"--maxmemory-policy allkeys-lru"` |  |
| redis.commonConfiguration | string | `"# Disable persistence to disk\nsave \"\"\n# Disable AOF https://redis.io/topics/persistence#append-only-file\nappendonly no"` |  |

----------------------------------------------
Autogenerated from chart metadata using [helm-docs v1.5.0](https://github.com/norwoodj/helm-docs/releases/v1.5.0)
