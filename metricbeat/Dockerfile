FROM docker.elastic.co/beats/metricbeat:7.12.1
LABEL app=kg-prototypes

COPY metricbeat.yml /usr/share/metricbeat/metricbeat.yml
USER ***ARANGO_USERNAME***
RUN chown ***ARANGO_USERNAME***:metricbeat /usr/share/metricbeat/metricbeat.yml
USER metricbeat
