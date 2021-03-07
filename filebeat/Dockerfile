FROM docker.elastic.co/beats/filebeat:7.11.1 AS base
ARG CONFIG_FILE=filebeat.yml
COPY config/filebeat.yml /usr/share/filebeat/${CONFIG_FILE}
USER ***ARANGO_USERNAME***
RUN chown ***ARANGO_USERNAME***:filebeat /usr/share/filebeat/${CONFIG_FILE}
USER filebeat
