FROM neo4j:3.5.14

COPY --chown=neo4j:neo4j . /var/lib/neo4j

RUN chown -R neo4j:neo4j /var/lib/neo4j
RUN chmod +x /var/lib/neo4j/seed-backup.sh

USER neo4j

# Perform a backup before running the docker script
ENTRYPOINT ["/sbin/tini", "-g", "--", "/var/lib/neo4j/seed-backup.sh"]

CMD ["neo4j"]
