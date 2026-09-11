# ========================================
# Base image
# ========================================
FROM python:3.8.2-slim as base

ENV LANG C.UTF-8
ENV LC_ALL C.UTF-8
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONFAULTHANDLER 1

RUN pip install pipenv


# ========================================
# Build dependencies stage
# ========================================
FROM base as build-deps

# Copy Pipfiles
COPY Pipfile Pipfile.lock ./

# Install Python dependencies
ARG DEV
RUN PIPENV_VENV_IN_PROJECT=1 pipenv install --deploy $(if [ "$DEV" ]; then echo --dev; fi)


# ========================================
# Runtime stage
# ========================================
FROM base
LABEL org.opencontainers.image.source https://github.com/SBRG/lifelike

# Install curl for self healthchecks.
# Debian buster (the base of python:3.8.2-slim) is end-of-life, so its packages
# are only served from archive.debian.org and its Release files are expired.
RUN sed -i -e 's|deb.debian.org/debian|archive.debian.org/debian|g' \
           -e 's|security.debian.org/debian-security|archive.debian.org/debian-security|g' \
           -e '/buster-updates/d' /etc/apt/sources.list \
    && apt-get -o Acquire::Check-Valid-Until=false update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python virtual environment
COPY --from=build-deps /.venv /.venv
ENV PATH="/.venv/bin:$PATH"

# Set user and working directory
WORKDIR /app
RUN useradd -m -d /app app
USER app

# Copy application code
COPY --chown=app . .

# ArangoDB configuration
ENV ARANGODB_HOST=''
ENV ARANGODB_PORT=''
ENV ARANGODB_AUTH=''
ENV ARANGODB_SCHEME=''

# Redis cache configuration
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379
ENV REDIS_PASSWORD=password
ENV REDIS_DB=0

# Default TTL for cache
ENV CACHE_TTL=86400

# Optional Elastic APM configuration.
# To enable, at least ELASTIC_APM_SERVER_URL must be set
# Other available variables: https://www.elastic.co/guide/en/apm/agent/python/master/configuration.html
ENV ELASTIC_APM_SERVER_URL=
ENV ELASTIC_APM_SERVICE_NAME=statistical-enrichment

# Flask env [development, testing, production]
ENV FLASK_ENV=production

# Listen port
ENV PORT=5000
EXPOSE $PORT

# Healtcheck
HEALTHCHECK --start-period=15s \
    CMD curl -f localhost:$PORT/healthz || exit 1

CMD bin/startup.sh
