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
| api.autoScaling.enabled | bool | `false` | If enabled, value at api.replicaCount will be ignored |
| api.autoScaling.maxReplicas | int | `4` |  |
| api.autoScaling.minReplicas | int | `2` |  |
| api.autoScaling.targetCPUUtilizationPercentage | int | `80` |  |
| api.autoScaling.targetMemoryUtilizationPercentage | int | `80` |  |
| api.dbWaiter.image.imagePullPolicy | string | `"IfNotPresent"` |  |
| api.dbWaiter.image.repository | string | `"willwill/wait-for-it"` |  |
| api.dbWaiter.image.tag | string | `"latest"` |  |
| api.dbWaiter.timeoutSeconds | int | `30` |  |
| api.extraEnv | object | `{}` | Extra environment variables to pass to the appserver |
| api.extraVolumeMounts[0].mountPath | string | `"/lmdb"` |  |
| api.extraVolumeMounts[0].name | string | `"lmdb"` |  |
| api.extraVolumeMounts[0].readOnly | bool | `false` |  |
| api.extraVolumes[0].hostPath.path | string | `"/mnt/data/lmdb"` |  |
| api.extraVolumes[0].name | string | `"lmdb"` |  |
| api.image.repository | string | `"us.gcr.io/able-goods-221820/***ARANGO_DB_NAME***-appserver"` |  |
| api.image.tag | string | `""` |  |
| api.livenessProbe.path | string | `"/meta/"` |  |
| api.lmdb.loadEnabled | bool | `false` |  |
| api.readinessProbe.path | string | `"/meta/"` |  |
| api.replicaCount | int | `2` | Number of replicas running the appserver |
| api.resources.requests.cpu | string | `"500m"` |  |
| api.resources.requests.memory | string | `"2000Mi"` |  |
| api.service.port | int | `5000` |  |
| api.strategyType | string | `"Recreate"` |  |
| elasticsearch.enabled | bool | `true` |  |
| elasticsearch.esConfig."elasticsearch.yml" | string | `"node.store.allow_mmap: false\n"` |  |
| elasticsearch.extraEnvs[0].name | string | `"ELASTIC_USERNAME"` |  |
| elasticsearch.extraEnvs[0].value | string | `"elastic"` |  |
| elasticsearch.extraEnvs[1].name | string | `"ELASTIC_PASSWORD"` |  |
| elasticsearch.extraEnvs[1].value | string | `"password"` |  |
| elasticsearch.fullnameOverride | string | `"elasticsearch"` |  |
| elasticsearch.replicas | int | `3` |  |
| elasticsearch.volumeClaimTemplate.resources.requests.storage | string | `"10Gi"` |  |
| elasticsearchExternal.host | string | `"elasticsearch.local"` |  |
| elasticsearchExternal.password | string | `""` |  |
| elasticsearchExternal.port | int | `9200` |  |
| elasticsearchExternal.user | string | `""` |  |
| frontend.autoScaling.enabled | bool | `false` |  |
| frontend.autoScaling.maxReplicas | int | `4` |  |
| frontend.autoScaling.minReplicas | int | `2` |  |
| frontend.autoScaling.targetCPUUtilizationPercentage | int | `80` |  |
| frontend.autoScaling.targetMemoryUtilizationPercentage | int | `80` |  |
| frontend.image.repository | string | `"us.gcr.io/able-goods-221820/***ARANGO_DB_NAME***-frontend"` |  |
| frontend.image.tag | string | `""` |  |
| frontend.livenessProbe.enabled | bool | `true` |  |
| frontend.livenessProbe.path | string | `"/"` |  |
| frontend.readinessProbe.enabled | bool | `true` |  |
| frontend.readinessProbe.path | string | `"/"` |  |
| frontend.replicaCount | int | `3` |  |
| frontend.service.port | int | `80` |  |
| fullnameOverride | string | `""` |  |
| global | object | `{}` |  |
| ingress.annotations | object | `{}` |  |
| ingress.className | string | `""` |  |
| ingress.enabled | bool | `true` |  |
| ingress.hostname | string | `"***ARANGO_DB_NAME***.local"` |  |
| ingress.tls | list | `[]` |  |
| nameOverride | string | `""` |  |
| neo4j.core.numberOfServers | int | `1` |  |
| neo4j.core.persistentVolume.size | string | `"100Gi"` |  |
| neo4j.core.standalone | bool | `true` |  |
| neo4j.enabled | bool | `true` |  |
| neo4j.imageTag | string | `"4.4.1-community"` |  |
| neo4j.neo4jPassword | string | `"password"` |  |
| neo4jExternal.database | string | `"neo4j"` |  |
| neo4jExternal.host | string | `"neo4j.local"` |  |
| neo4jExternal.password | string | `"password"` |  |
| neo4jExternal.port | int | `7687` |  |
| neo4jExternal.user | string | `"neo4j"` |  |
| pdfparser.autoScaling | object | `{"enabled":false,"maxReplicas":4,"minReplicas":2,"targetCPUUtilizationPercentage":80,"targetMemoryUtilizationPercentage":80}` | Horizontal pod autoscaler configuration |
| pdfparser.autoScaling.enabled | bool | `false` | Set to true to enable autoscaling, ignoring pdfparser.replicaCount |
| pdfparser.image.repository | string | `"us.gcr.io/able-goods-221820/pdfparser"` |  |
| pdfparser.image.tag | string | `"latest"` |  |
| pdfparser.livenessProbe.enabled | bool | `true` | Set to false to disable liveness probes |
| pdfparser.livenessProbe.path | string | `"/"` |  |
| pdfparser.readinessProbe.enabled | bool | `true` |  |
| pdfparser.readinessProbe.path | string | `"/"` |  |
| pdfparser.replicaCount | int | `3` | Number of replicas running, ignored if autoScaling is enabled |
| pdfparser.service.port | int | `7600` |  |
| postgresql.enabled | bool | `true` | Set to false to disable automatic deployment of PostgreSQL |
| postgresql.postgresqlDatabase | string | `"postgres"` |  |
| postgresqlExternal.database | string | `"postgres"` |  |
| postgresqlExternal.host | string | `"postgres.local"` |  |
| postgresqlExternal.password | string | `"postgres"` |  |
| postgresqlExternal.port | int | `5432` |  |
| postgresqlExternal.user | string | `"postgres"` |  |
| redis.architecture | string | `"standalone"` |  |
| redis.auth.password | string | `"password"` |  |
| redis.commonConfiguration | string | `"# Disable persistence to disk\nsave \"\"\n# Disable AOF https://redis.io/topics/persistence#append-only-file\nappendonly no"` |  |
| redis.enabled | bool | `true` |  |
| redis.master.extraFlags[0] | string | `"--maxmemory-policy allkeys-lru"` |  |
| redis.master.persistence.enabled | bool | `false` |  |
| redis.replica.extraFlags[0] | string | `"--maxmemory-policy allkeys-lru"` |  |
| redis.replica.persistence.enabled | bool | `false` |  |
| redisExternal.host | string | `"redis.local"` |  |
| redisExternal.password | string | `""` |  |
| redisExternal.port | int | `6379` |  |
| serviceAccount.annotations | object | `{}` |  |
| serviceAccount.create | bool | `true` |  |
| serviceAccount.name | string | `""` |  |
| statisticalEnrichment.image.repository | string | `"us.gcr.io/able-goods-221820/***ARANGO_DB_NAME***-statistical-enrichment"` |  |
| statisticalEnrichment.image.tag | string | `""` |  |
| statisticalEnrichment.livenessProbe.path | string | `"/healthz"` |  |
| statisticalEnrichment.readinessProbe.path | string | `"/healthz"` |  |
| statisticalEnrichment.replicaCount | int | `2` |  |
| statisticalEnrichment.resources | object | `{}` |  |
| statisticalEnrichment.service.port | int | `5000` |  |
| statisticalEnrichment.service.type | string | `"ClusterIP"` |  |
| worker.autoScaling | object | `{"enabled":false,"maxReplicas":4,"minReplicas":2,"targetCPUUtilizationPercentage":80,"targetMemoryUtilizationPercentage":80}` | Horizontal pod autoscaler configuration |
| worker.autoScaling.enabled | bool | `false` | Set to true to enable autoscaling, ignoring pdfparser.replicaCount |
| worker.image.repository | string | `"us.gcr.io/able-goods-221820/***ARANGO_DB_NAME***-appserver"` |  |
| worker.image.tag | string | `""` |  |
| worker.replicaCount | int | `3` | Number of running replicas, ignored if autoScaling is enabled |

----------------------------------------------
Autogenerated from chart metadata using [helm-docs v1.5.0](https://github.com/norwoodj/helm-docs/releases/v1.5.0)
