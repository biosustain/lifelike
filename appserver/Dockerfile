FROM fedora:32

# Install dependencies
RUN dnf install postgresql graphviz python-pip python3-devel which -y \
    && dnf groupinstall 'Development Tools' -y \
    && dnf clean packages
RUN pip install pipenv

ENV N4J_USER n4j
ENV N4J_HOME /home/$N4J_USER
ENV UID 1000
ENV GID 1000

# User and group creation
RUN groupadd -g $GID $N4J_USER && \
    useradd -u $UID -g $GID -G wheel --create-home --home-dir $N4J_HOME --shell /bin/bash $N4J_USER

WORKDIR $N4J_HOME

# Copy Pipfiles and install dependencies FIRST to better apply Docker layer cache
COPY --chown=1000:1000 Pipfile .
COPY --chown=1000:1000 Pipfile.lock .
RUN pipenv install --dev --deploy --system

# ...then copy everything else
COPY --chown=1000:1000 . .

# TODO: We should consider breaking this apart into dev and prod
# builds, so we don't build unnecessary packages

# Don't lose stdin, stdout and stderr output due to buffering
ENV PYTHONUNBUFFERED 1
ENV PYTHONPATH $N4J_HOME

RUN echo 'alias python=python3' >> ~/.bashrc && source ~/.bashrc

USER $N4J_USER
