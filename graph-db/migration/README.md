# ***ARANGO_DB_NAME***-liquibase DB migrator


## Run with Docker

To run migrations from Lifelike Docker registry latest image, you can run the following command:

```bash
docker run --rm --network host
  --env NEO4J_HOST=http://localhost:7687 \
  --env NEO4J_USERNAME=neo4j --env NEO4J_PASSWORD=password \
  --env AZURE_ACCOUNT_STORAGE_KEY=<your-key> \
  ***ARANGO_DB_NAME***.azurecr.io/liquibase:latest \
  update
```

### Environment Variables

| Variable                   | Default value | Comment                       |
| -------------------------- | ------------- | ----------------------------- |
| NEO4J_HOST                 | neo4j:7687    | Host and port of target Neo4j instance (Bolt protocol) |
| NEO4J_USERNAME             | neo4j         | Neo4j authentication username |
| NEO4J_PASSWORD             | password      | Neo4j authentication password |
| NEO4J_DATABASE             | neo4j         | Neo4j target database         |
| STORAGE_TYPE               | azure         | Remote storage type from where to download datasets (`azure` is currently only supported) |
| AZURE_ACCOUNT_STORAGE_NAME | ***ARANGO_DB_NAME***      | Azure Storage Account Name    |
| AZURE_ACCOUNT_STORAGE_KEY  |               | Required. Azure Storage Key   |
| LOG_LEVEL                  | WARNING       | Liquibase log level           |

### Build Docker image

```bash
docker build -t ***ARANGO_DB_NAME***-liquibase .
```

### Docker build arguments

| Argument                | Default value | Comment |
| ----------------------- | ------------- | ------- |
| LIQUIBASE_IMAGE_TAG     | 4.6 | Tag of the [Liquibase Docker image](https://hub.docker.com/r/liquibase/liquibase/tags) to use |
| LIQUIBASE_NEO4J_VERSION | 4.6.2 | [Liquibase-Neo4j plugin](https://github.com/liquibase/liquibase-neo4j) version to install |
| NEO4J_JDBC_VERSION      | 4.0.4 | Neo4j JDBC driver version |
