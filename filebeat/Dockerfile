FROM docker.elastic.co/beats/filebeat:7.9.1
COPY config/filebeat.yml /usr/share/filebeat/filebeat.yml
USER ***ARANGO_USERNAME***
RUN chown ***ARANGO_USERNAME***:filebeat /usr/share/filebeat/filebeat.yml
USER filebeat
