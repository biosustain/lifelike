FROM python:3.7.1

# Install psql to check on postgres availability
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

ENV N4J_USER n4j
ENV N4J_HOME /home/$N4J_USER

ENV UID 1000
ENV GID 1000

RUN groupadd -g $GID $N4J_USER && \
    useradd -u $UID -g $GID -G sudo --create-home --home-dir $N4J_HOME --shell /bin/bash $N4J_USER

COPY --chown=1000:1000 . $N4J_HOME

# Set workdir to app ***ARANGO_USERNAME*** so pipenv can find Pipfile
WORKDIR $N4J_HOME

# TODO: We should consider breaking this apart into dev and prod
# builds, so we don't build unnecessary packages

# Install pipenv and install all python packages, including dev.
RUN pip install pipenv
RUN pipenv install --dev --deploy --system

# Don't lose stdin, stdout and stderr output due to buffering
ENV PYTHONUNBUFFERED 1
ENV PYTHONPATH $N4J_HOME

USER $N4J_USER
