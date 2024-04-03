FROM python:3.10-slim as base
LABEL app=kg-prototypes

# Install dependencies
RUN apt-get update && apt-get install -y curl && apt-get clean
RUN pip install pipenv

ENV APP_USER lifelike
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

# Don't lose stdin, stdout and stderr output due to buffering
ENV PYTHONUNBUFFERED 1
ENV PYTHONPATH $APP_HOME

USER $APP_USER

CMD [ "bin/startup.sh" ]
