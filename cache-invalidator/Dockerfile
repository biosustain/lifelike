FROM python:3.10-slim as base
LABEL app=kg-prototypes

# Install dependencies
RUN apt-get update && apt-get install -y curl && apt-get clean
RUN pip install pipenv

ENV APP_USER ***ARANGO_DB_NAME***
ENV APP_HOME /home/$APP_USER
ENV UID 1000
ENV GID 1000

# User and group creation
RUN groupadd -g $GID $APP_USER && \
    useradd -u $UID -g $GID -G sudo --create-home --home-dir $APP_HOME --shell /bin/bash $APP_USER

WORKDIR $APP_HOME

# Copy Pipfiles and install dependencies FIRST to better apply Docker layer cache
COPY --chown=1000:1000 Pipfile .
COPY --chown=1000:1000 Pipfile.lock .
RUN pipenv install --deploy --dev --system

# ...then copy everything else
COPY --chown=1000:1000 . .

# Set non-***ARANGO_USERNAME*** runtime user
RUN groupadd -g 999 appuser && \
    useradd -r -u 999 -g appuser appuser
USER 999

# Environment variables
ENV PYTHONUNBUFFERED 1
ENV PYTHONPATH /app

# Redis server
ENV LOG_LEVEL INFO
ENV REDIS_HOST redis
ENV REDIS_PORT 6379
ENV REDIS_PASSWORD ""

# Neo4j server
ENV NEO4J_HOST neo4j
ENV NEO4J_AUTH neo4j/password

CMD [ "bin/startup.sh" ]
