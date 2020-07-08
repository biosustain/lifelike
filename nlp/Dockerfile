FROM python:3.6.9

# First add support for https apt source
RUN apt-get update && apt-get install -y apt-transport-https ca-certificates sudo

ENV NLP_USER nlp-api-user
ENV NLP_HOME /home/$NLP_USER

# Maps to the default user on the host.
# We want the host user to own any files generated from the docker
# container during development
ENV UID 1000
ENV GID 1000

RUN groupadd -g $GID $NLP_USER && \
    useradd -u $UID -g $GID -p '' -G sudo --create-home --home-dir $NLP_HOME --shell /bin/bash $NLP_USER

RUN apt-get install -y python3-dev

COPY ./requirements.txt /

RUN pip3 install --upgrade pip

RUN pip3 install -r /requirements.txt

# Now copy over the source
COPY --chown=nlp-api-user . $NLP_HOME

# Don't lose stdin, stdout and stderr output due to buffering
ENV PYTHONUNBUFFERED 1
ENV PYTHONPATH $NLP_HOME

WORKDIR $NLP_HOME

USER $NLP_USER

CMD [ "bin/run_server.sh" ]
