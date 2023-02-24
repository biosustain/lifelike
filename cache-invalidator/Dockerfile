FROM python:3.8-slim-buster

# Install pipenv
RUN pip install pipenv

WORKDIR /app

# Copy Pipfiles and install Python dependencies
COPY Pipfile Pipfile.lock ./
RUN pipenv install --deploy --dev --system

# Copy application file
COPY main.py ./
COPY bin ./bin

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
