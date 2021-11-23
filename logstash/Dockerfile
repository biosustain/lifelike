FROM docker.elastic.co/logstash/logstash:7.10.1
LABEL app=kg-prototypes

RUN rm -f /usr/share/logstash/pipeline/logstash.conf
COPY pipeline/ /usr/share/logstash/pipeline
COPY config/ /usr/share/logstash/config
