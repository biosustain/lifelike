# Lifelike Graph DB migrator

Liquibase based migrator for Neo4j

## Run with Docker

To run migrations from Lifelike Docker registry latest image, you can run the following command:

```bash
# Update migrations
docker run --rm \
  --env NEO4J_HOST=neo4j:7687 \
  --env NEO4J_PASSWORD=password \
  --env AZURE_ACCOUNT_STORAGE_NAME=***ARANGO_DB_NAME*** \
  --env AZURE_ACCOUNT_STORAGE_KEY=<storage-key> \
  --env CHANGELOG_DIR=***ARANGO_DB_NAME***-graph
  ghcr.io/sbrg/***ARANGO_DB_NAME***-graphdb-migrator:latest
```

### Environment Variables

| Variable                   | Default        | Comment                             |
| -------------------------- | -------------- | ----------------------------------- |
| CHANGELOG_DIR              | ***ARANGO_DB_NAME***-graph | Master changelog directory path     |
| NEO4J_HOST                 |                | Host and port of Neo4j instance     |
| NEO4J_USERNAME             | neo4j          | Neo4j authentication username       |
| NEO4J_PASSWORD             | password       | Neo4j authentication password       |
| NEO4J_DATABASE             | neo4j          | Neo4j target database               |
| STORAGE_TYPE               | azure          | Remote storage type to get TSV data |
| AZURE_ACCOUNT_STORAGE_NAME |                | Azure Storage Account Name          |
| AZURE_ACCOUNT_STORAGE_KEY  |                | Azure Storage Key                   |
| LOG_LEVEL                  | WARNING        | Liquibase log level                 |

### Docker build arguments

| Argument                | Default value | Comment |
| ----------------------- | ------------- | ------- |
| LIQUIBASE_IMAGE_TAG     | 4.6 | Tag of the [Liquibase Docker image](https://hub.docker.com/r/liquibase/liquibase/tags) to use |
| LIQUIBASE_NEO4J_VERSION | 4.6.2 | [Liquibase-Neo4j plugin](https://github.com/liquibase/liquibase-neo4j) version to install |
| NEO4J_JDBC_VERSION      | 4.0.5 | Neo4j JDBC driver version |
