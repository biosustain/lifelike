{{/* vim: set filetype=mustache: */}}

{{/*
Expand the name of the chart.
*/}}
{{- define "***ARANGO_DB_NAME***.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "***ARANGO_DB_NAME***.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/* ---------------------------------------------------------------------- */}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "***ARANGO_DB_NAME***.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* ---------------------------------------------------------------------- */}}

{{/*
Common labels
*/}}
{{- define "***ARANGO_DB_NAME***.labels" -}}
helm.sh/chart: {{ include "***ARANGO_DB_NAME***.chart" . }}
{{ include "***ARANGO_DB_NAME***.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/* ---------------------------------------------------------------------- */}}

{{/*
Selector labels
*/}}
{{- define "***ARANGO_DB_NAME***.selectorLabels" -}}
app.kubernetes.io/name: {{ include "***ARANGO_DB_NAME***.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/* ---------------------------------------------------------------------- */}}

{{/*
Create the name of the service account to use
*/}}
{{- define "***ARANGO_DB_NAME***.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "***ARANGO_DB_NAME***.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/* ---------------------------------------------------------------------- */}}
{{/* PostgreSQL                                                             */}}
{{/* ---------------------------------------------------------------------- */}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "***ARANGO_DB_NAME***.postgresql.fullname" -}}
{{- if .Values.postgresql.fullnameOverride -}}
{{- .Values.postgresql.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default "postgresql" .Values.postgresql.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Return the PostgreSQL hostname
*/}}
{{- define "***ARANGO_DB_NAME***.postgresqlHost" -}}
{{- if .Values.postgresql.enabled }}
    {{- printf "%s" (include "***ARANGO_DB_NAME***.postgresql.fullname" .) -}}
{{- else -}}
    {{- printf "%s" .Values.postgresqlExternal.host -}}
{{- end -}}
{{- end -}}

{{/*
Return the PostgreSQL port
*/}}
{{- define "***ARANGO_DB_NAME***.postgresqlPort" -}}
{{- if .Values.postgresql.enabled }}
    {{- printf "5432" -}}
{{- else -}}
    {{- .Values.postgresqlExternal.port -}}
{{- end -}}
{{- end -}}


{{/*
Return the PostgreSQL database name
*/}}
{{- define "***ARANGO_DB_NAME***.postgresqlDatabase" -}}
{{- if .Values.postgresql.enabled }}
    {{- printf "%s" .Values.postgresql.postgresqlDatabase -}}
{{- else -}}
    {{- printf "%s" .Values.postgresqlExternal.database -}}
{{- end -}}
{{- end -}}

{{/*
Return the PostgreSQL user
*/}}
{{- define "***ARANGO_DB_NAME***.postgresqlUser" -}}
{{- if .Values.postgresql.enabled }}
    {{- printf "%s" .Values.postgresql.postgresqlUsername -}}
{{- else -}}
    {{- printf "%s" .Values.postgresqlExternal.user -}}
{{- end -}}
{{- end -}}

{{/*
Return the PostgreSQL password
*/}}
{{- define "***ARANGO_DB_NAME***.postgresqlPassword" -}}
{{- if .Values.postgresql.enabled }}
    {{- printf "%s" .Values.postgresql.postgresqlPassword -}}
{{- else -}}
    {{- printf "%s" .Values.postgresqlExternal.password -}}
{{- end -}}
{{- end -}}


{{/* ---------------------------------------------------------------------- */}}
{{/* Neo4J                                                                  */}}
{{/* ---------------------------------------------------------------------- */}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "***ARANGO_DB_NAME***.neo4j.fullname" -}}
{{- if .Values.neo4j.fullnameOverride -}}
{{- .Values.neo4j.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default "neo4j" .Values.neo4j.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Return the Neo4j hostname
*/}}
{{- define "***ARANGO_DB_NAME***.neo4jHost" -}}
{{- if .Values.neo4j.enabled }}
    {{- printf "%s" (include "***ARANGO_DB_NAME***.neo4j.fullname" .) -}}
{{- else -}}
    {{- printf "%s" .Values.neo4jExternal.host -}}
{{- end -}}
{{- end -}}

{{/*
Return the Neo4j port
*/}}
{{- define "***ARANGO_DB_NAME***.neo4jPort" -}}
{{- if .Values.neo4j.enabled }}
    {{- printf "7687" -}}
{{- else -}}
    {{- .Values.neo4jExternal.port -}}
{{- end -}}
{{- end -}}

{{/*
Return the Neo4j user
*/}}
{{- define "***ARANGO_DB_NAME***.neo4jUser" -}}
{{- if .Values.neo4j.enabled }}
    {{- printf "neo4j" -}}
{{- else -}}
    {{- printf "%s" .Values.neo4jExternal.user -}}
{{- end -}}
{{- end -}}

{{/*
Return the Neo4j password
*/}}
{{- define "***ARANGO_DB_NAME***.neo4jPassword" -}}
{{- if .Values.neo4j.enabled }}
    {{- printf "%s" .Values.neo4j.neo4jPassword -}}
{{- else -}}
    {{- printf "%s" .Values.neo4jExternal.password -}}
{{- end -}}
{{- end -}}

{{/* ---------------------------------------------------------------------- */}}
{{/* Elasticsearch                                                          */}}
{{/* ---------------------------------------------------------------------- */}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "***ARANGO_DB_NAME***.elasticsearch.fullname" -}}
{{- if .Values.elasticsearch.fullnameOverride -}}
{{- .Values.elasticsearch.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default "elasticsearch" .Values.elasticsearch.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Return the Elasticsearch hostname
*/}}
{{- define "***ARANGO_DB_NAME***.elasticsearchHost" -}}
{{- if .Values.elasticsearch.enabled }}
    {{- printf "%s" (include "***ARANGO_DB_NAME***.elasticsearch.fullname" .) -}}
{{- else -}}
    {{- printf "%s" .Values.elasticsearchExternal.host -}}
{{- end -}}
{{- end -}}

{{/*
Return the Elasticsearch port
*/}}
{{- define "***ARANGO_DB_NAME***.elasticsearchPort" -}}
{{- if .Values.elasticsearch.enabled }}
    {{- printf "9200" -}}
{{- else -}}
    {{- .Values.elasticsearchExternal.port | quote -}}
{{- end -}}
{{- end -}}

{{/*
Return the Neo4j user
*/}}
{{- define "***ARANGO_DB_NAME***.elasticsearchUser" -}}
{{- if .Values.elasticsearch.enabled }}
    {{- range $env := .Values.elasticsearch.extraEnvs }}
    {{- if eq $env.name "ELASTIC_USERNAME" }}
        {{- printf "%s" $env.value -}}
    {{- end -}}
    {{- end -}}
{{- else -}}
    {{- printf "%s" .Values.elasticsearchExternal.user -}}
{{- end -}}
{{- end -}}

{{/*
Return the Elasticsearch password
*/}}
{{- define "***ARANGO_DB_NAME***.elasticsearchPassword" -}}
  {{- if .Values.elasticsearch.enabled }}
  {{- range $env := .Values.elasticsearch.extraEnvs }}
    {{- if eq $env.name "ELASTIC_PASSWORD" }}
      {{- printf "%s" $env.value -}}
    {{- end -}}
  {{- end -}}
{{- else -}}
  {{- printf "%s" .Values.elasticsearchExternal.password -}}
{{- end -}}
{{- end -}}

{{/* ---------------------------------------------------------------------- */}}
{{/* Redis                                                                  */}}
{{/* ---------------------------------------------------------------------- */}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "***ARANGO_DB_NAME***.redis.fullname" -}}
{{- if .Values.redis.fullnameOverride -}}
{{- .Values.redis.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default "redis" .Values.redis.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Return the Redis hostname
*/}}
{{- define "***ARANGO_DB_NAME***.redisHost" -}}
{{- if .Values.redis.enabled }}
  {{- printf "%s-master" (include "***ARANGO_DB_NAME***.redis.fullname" .) -}}
{{- else -}}
  {{- printf "%s" .Values.redisExternal.host -}}
{{- end -}}
{{- end -}}

{{/*
Return the Redis port
*/}}
{{- define "***ARANGO_DB_NAME***.redisPort" -}}
  {{- if .Values.redis.enabled }}
    {{- printf "6379" -}}
  {{- else -}}
    {{- .Values.redisExternal.port -}}
  {{- end -}}
{{- end -}}

{{/*
Return the Redis password
*/}}
{{- define "***ARANGO_DB_NAME***.redisPassword" -}}
{{- if .Values.redis.enabled }}
    {{- printf "%s" .Values.redis.auth.password -}}
{{- else -}}
    {{- printf "%s" .Values.redisExternal.password -}}
{{- end -}}
{{- end -}}
