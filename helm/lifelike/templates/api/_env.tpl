{{- define "***ARANGO_DB_NAME***.apiEnv" -}}
- name: POSTGRES_HOST
  value: {{ template "***ARANGO_DB_NAME***.postgresqlHost" . }}
- name: POSTGRES_PORT
  value: {{ include "***ARANGO_DB_NAME***.postgresqlPort" . | quote }}
- name: POSTGRES_USER
  value: {{ template "***ARANGO_DB_NAME***.postgresqlUser" . }}
- name: POSTGRES_PASSWORD
  value: {{ include "***ARANGO_DB_NAME***.postgresqlPassword" . | quote }}
- name: POSTGRES_DB
  value: {{ template "***ARANGO_DB_NAME***.postgresqlDatabase" . }}
- name: NEO4J_HOST
  value: {{ template "***ARANGO_DB_NAME***.neo4jHost" . }}
- name: NEO4J_PORT
  value: {{ include "***ARANGO_DB_NAME***.neo4jPort" . | quote }}
- name: NEO4J_AUTH
  value: {{ template "***ARANGO_DB_NAME***.neo4jUser" . }}/{{ template "***ARANGO_DB_NAME***.neo4jPassword" . }}
- name: NEO4J_DB
  value: {{ template "***ARANGO_DB_NAME***.neo4jDatabase" . }}
- name: REDIS_HOST
  value: {{ template "***ARANGO_DB_NAME***.redisHost" . }}
- name: REDIS_PORT
  value: {{ include "***ARANGO_DB_NAME***.redisPort" . | quote }}
- name: REDIS_PASSWORD
  value: {{ include "***ARANGO_DB_NAME***.redisPassword" . | quote }}
- name: ELASTICSEARCH_HOST
  value: "{{ printf "%s://%s:%s@%s:%s" "http" (include "***ARANGO_DB_NAME***.elasticsearchUser" .) (include "***ARANGO_DB_NAME***.elasticsearchPassword" .) (include "***ARANGO_DB_NAME***.elasticsearchHost" .) (include "***ARANGO_DB_NAME***.elasticsearchPort" .) }}"
{{- range $envName, $envValue := .Values.api.extraEnv }}
- name: {{ $envName }}
  value: {{ $envValue | quote }}
{{- end -}}
{{- end -}}
