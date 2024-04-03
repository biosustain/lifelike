FROM docker.elastic.co/beats/filebeat:7.11.1
LABEL app=kg-prototypes

COPY config/filebeat.yml /usr/share/filebeat/filebeat.yml
USER root
RUN chown root:filebeat /usr/share/filebeat/filebeat.yml
USER filebeat
