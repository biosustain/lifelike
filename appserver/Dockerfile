# ========================================
# Base image
# ========================================
FROM fedora:32 as base

ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONFAULTHANDLER 1


# ========================================
# Build dependencies stage
# ========================================
FROM base as build-deps

# Install dependencies
RUN dnf install -y python3-devel && dnf groupinstall -y 'Development Tools'
RUN pip install pipenv

# Copy Pipfiles and install dependencies
COPY Pipfile Pipfile.lock ./

ARG DEV
RUN PIPENV_VENV_IN_PROJECT=1 pipenv install --deploy $(if [ "$DEV" ]; then echo --dev; fi)

# ========================================
# Runtime stage
# ========================================
FROM base
LABEL app=kg-prototypes

# Install runtime system dependencies
RUN dnf install -y graphviz && dnf clean packages

# Copy Python virtual environment
COPY --from=build-deps /.venv /.venv
ENV PATH="/.venv/bin:$PATH"

# Add unprivileged user
RUN useradd --create-home n4j
WORKDIR /home/h4j

# Copy application code
COPY --chown=n4j . .

# Configuration variables
ENV FLASK_ENV=development
ENV DOMAIN=http://localhost:4242

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
ENV NEO4J_SCHEME=bolt

# Elasticsearch configuration
ENV ELASTICSEARCH_HOSTS=http://elasticsearch:9200
ENV ELAASTICSEARCH_USERNAME=elastic
ENV ELAASTICSEARCH_PASSWORD=elastic
ENV ELASTIC_APM_SERVER_URL=

ENV JWT_SECRET=secret
ENV NLP_SERVICE_ENDPOINT=https://nlp-api.***ARANGO_DB_NAME***.bio/v1/predict
ENV NLP_SECRET=secret
ENV PDFPARSER_ENDPOINT=http://pdfparser:7600
ENV PORT=5000

# Add wait tool
ENV WAIT_VERSION 2.9.0
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/$WAIT_VERSION/wait /wait
RUN chmod +x /wait

USER n4j
EXPOSE $PORT
CMD /wait && bin/startup.sh
