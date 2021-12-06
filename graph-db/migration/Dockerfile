ARG LIQUIBASE_IMAGE_TAG=4.6

# ========================================
# Maven build stage
# ========================================
FROM maven:3.8-jdk-11 as build

# Install dependencies
COPY pom.xml ./
RUN mvn -B dependency:go-offline

# Copy code and build JAR
COPY src ./src
RUN mvn -B clean package -DskipTests


# ========================================
# Liquibase runtime stage
# ========================================
FROM liquibase/liquibase:$LIQUIBASE_IMAGE_TAG

# Install liquibase-neo4j extension
ARG LIQUIBASE_NEO4J_VERSION=4.6.1
RUN lpm update && lpm add --global liquibase-neo4j@$LIQUIBASE_NEO4J_VERSION

# Download Neo4j JDBC driver
ARG NEO4J_JDBC_VERSION=4.0.4
ADD --chown=liquibase:liquibase https://github.com/neo4j-contrib/neo4j-jdbc/releases/download/${NEO4J_JDBC_VERSION}/neo4j-jdbc-driver-${NEO4J_JDBC_VERSION}.jar lib/

# Copy JAR from build stage
COPY --from=build --chown=liquibase:liquibase /target/***ARANGO_DB_NAME***-liquibase-*.jar ./lib

# Copy changelog directory
COPY --chown=liquibase:liquibase liquibase ./changelog

# Neo4j database configuration
ENV NEO4J_HOST=neo4j:7687
ENV NEO4J_USERNAME=neo4j
ENV NEO4J_PASSWORD=password
ENV NEO4J_DATABASE=neo4j

# Remote storage configuration
ENV STORAGE_TYPE=azure
ENV STORAGE_AZURE_ACCOUNT_NAME=***ARANGO_DB_NAME***
ENV STORAGE_AZURE_ACCOUNT_KEY=pom

# Liquibase configuration
ENV LOG_LEVEL=INFO

# Override parent image entrypoint
COPY --chown=liquibase:liquibase docker-entrypoint.sh ./

USER ***ARANGO_USERNAME***
