FROM neo4j:3.5.14

ENV N4J_USER neo4j
ENV N4J_WORKDIR /var/lib/neo4j

USER $N4J_USER

WORKDIR $N4J_WORKDIR

COPY --chown=$N4J_USER:$N4J_USER . $N4J_WORKDIR

RUN neo4j-admin load --from=$N4J_WORKDIR/backups/dev-backup.dump --database=graph.db --force
