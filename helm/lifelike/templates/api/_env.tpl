{{- define "***ARANGO_DB_NAME***.apiEnv" -}}
{{ include "***ARANGO_DB_NAME***.poostgresEnv" . }}
{{ include "***ARANGO_DB_NAME***.neo4jEnv" . }}
{{ include "***ARANGO_DB_NAME***.redisEnv" . }}
- name: ELASTICSEARCH_URL
  value: {{ include "***ARANGO_DB_NAME***.elasticsearchUrl" . }}
- name: PDFPARSER_URL
  value: http://{{ include "***ARANGO_DB_NAME***.fullname" . }}-pdfparser:{{ .Values.pdfparser.service.port }}
- name: APPSERVER_URL
  value: http://{{ include "***ARANGO_DB_NAME***.fullname" . }}-api:{{ .Values.api.service.port }}
{{- if .Values.ingress.enabled }}
- name: FRONTEND_URL
  value: https://{{ .Values.ingress.hostname }}
{{- end }}
{{- range $envName, $envValue := .Values.api.extraEnv }}
- name: {{ $envName }}
  value: {{ $envValue | quote }}
{{- end -}}
{{- end -}}
