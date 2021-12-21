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

# Elasticsearch configuration
ENV ELASTICSEARCH_HOSTS=http://elasticsearch:9200
ENV ELAASTICSEARCH_USERNAME=elastic
ENV ELAASTICSEARCH_PASSWORD=password

# Statistical enrichment service
ENV STATISTICAL_ENRICHMENT_URL=http://statistical-enrichment:5000

# Analysis services
ENV PDFPARSER_ENDPOINT=http://pdfparser:7600
ENV NLP_SERVICE_ENDPOINT=https://nlp-api.***ARANGO_DB_NAME***.bio/v1/predict
ENV NLP_SECRET=secret

# Misc configuration
ENV FLASK_ENV=production
ENV DOMAIN=http://localhost:4242
ENV JWT_SECRET=secret
ENV ELASTIC_APM_SERVER_URL=

# Listen port
ENV PORT=5000
EXPOSE $PORT

CMD ["bin/startup.sh"]
