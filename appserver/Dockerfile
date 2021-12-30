# ========================================
# Base image
# ========================================
FROM fedora:35 as base

ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONFAULTHANDLER 1

RUN dnf install -y pipenv


# ========================================
# Build dependencies stage
# ========================================
FROM base as build-deps

# Install build dependencies
RUN dnf install -y python3-devel libxml2-devel libxslt-devel && \
    dnf groupinstall -y 'Development Tools'

# Copy Pipfiles
COPY Pipfile Pipfile.lock ./

# Install Python dependencies
ARG DEV
RUN PIPENV_VENV_IN_PROJECT=1 pipenv install --deploy $(if [ "$DEV" ]; then echo --dev; fi)


# ========================================
# Runtime stage
# ========================================
FROM base
LABEL app=***ARANGO_DB_NAME***

# Install runtime system dependencies
RUN dnf install -y graphviz && dnf clean packages

# Copy Python virtual environment
COPY --from=build-deps /.venv /.venv
ENV PATH="/.venv/bin:$PATH"

# Set user and workdir
WORKDIR /app
RUN useradd -m -d /app app
USER app

# Copy application code
COPY --chown=app . .

# Set to 1 to automatically apply any pending DB migrations at startup
ENV MIGRATE_DB=

# Create an initial admin user
ENV INITIAL_ADMIN_USER=admin@example.com
ENV INITIAL_ADMIN_PASSWORD=password

# LMDB database volume
ENV LMDB_DATA_DIR=/lmdb
VOLUME /lmdb

# LMDB download cloud storage
# ENV AZURE_ACCOUNT_STORAGE_NAME=
# ENV AZURE_ACCOUNT_STORAGE_KEY=

# Base URL of this app, reachable by external services
ENV APPSERVER_URL=http://localhost:5000

# Base URL of the frontend app, for link generation
ENV FRONTEND_URL=http://localhost:4242

# PostgreSQL configuration
ENV POSTGRES_HOST=postgres
ENV POSTGRES_PORT=5432
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres
ENV POSTGRES_DB=postgres

# Neo4j configuration
ENV NEO4J_HOST=neo4j
ENV NEO4J_PORT=7687
ENV NEO4J_AUTH=neo4j/password
ENV NEO4J_DATABASE=neo4j
ENV NEO4J_SCHEME=bolt

# Elasticsearch node URL(s)
ENV ELASTICSEARCH_HOSTS=http://elasticsearch:9200
# Elasticsearch files ndex name
ENV ELASTIC_FILE_INDEX_ID=file

# Statistical enrichment service
ENV STATISTICAL_ENRICHMENT_URL=http://statistical-enrichment:5000

# PDFParser
ENV PDFPARSER_ENDPOINT=http://pdfparser:7600

# NLP Processing
ENV NLP_SERVICE_ENDPOINT=https://nlp-api.***ARANGO_DB_NAME***.bio/v1/predict
ENV NLP_SECRET=secret

# Auth secret token
ENV JWT_SECRET=secret

# Sendgrid API key
ENV SEND_GRID_EMAIL_API_KEY=

# Enables Sentry logging service (optional)
ENV SENTRY_DSN=

# Enables Elastic APM for perfoemance monitoring (Optional)
ENV ELASTIC_APM_SERVER_URL=
ENV ENVIRONMENT_NAME=

# Flask env [development, testing, production]
ENV FLASK_ENV=production

# Listen port
ENV PORT=5000
EXPOSE $PORT

RUN chmod +x bin/docker-entrypoint.sh
ENTRYPOINT [ "bin/docker-entrypoint.sh" ]
