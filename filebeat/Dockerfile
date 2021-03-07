FROM docker.elastic.co/beats/filebeat:7.11.1
ARG CONFIG_FILE=filebeat.yml
COPY config/${CONFIG_FILE} /usr/share/filebeat/filebeat.yml
USER ***ARANGO_USERNAME***
RUN chown ***ARANGO_USERNAME***:filebeat /usr/share/filebeat/filebeat.yml
USER filebeat
