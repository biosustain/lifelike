FROM docker.elastic.co/elasticsearch/elasticsearch:7.3.1

ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]


RUN echo 'y' | elasticsearch-plugin install ingest-attachment

# Below is taken from the elasticsearch Dockerfile
# ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
# Dummy overridable parameter parsed by entrypoint
CMD ["/usr/local/bin/docker-entrypoint.sh", "eswrapper"]
RUN mkdir -p /usr/share/elasticsearch/data
RUN chmod a+rw /usr/share/elasticsearch/data/
