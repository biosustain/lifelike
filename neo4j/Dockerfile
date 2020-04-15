FROM neo4j:3.5.14

COPY --chown=neo4j:neo4j . /var/lib/neo4j

USER neo4j

RUN neo4j-admin load --from=./backups/dev-backup.dump --database=graph.db --force
