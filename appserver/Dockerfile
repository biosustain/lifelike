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
USER n4j

# Copy application code
COPY --chown=n4j . .

ENV FLASK_ENV=development
ENV DOMAIN=http://localhost:4242
ENV JWT_SECRET=secret
ENV NLP_SECRET=secret
ENV ELASTICSEARCH_HOSTS=http://elasticsearch:9200
ENV ELASTIC_APM_SERVER_URL=

EXPOSE 5000
CMD [ "bin/startup.sh" ]
