FROM python:3.6-buster AS builder

ENV NLP_USER nlp-api-user
ENV NLP_HOME /home/$NLP_USER
WORKDIR $NLP_HOME

# Turns off writing .pyc files
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PATH="/venv/bin:$PATH"

# First add support for https apt source
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    apt-transport-https ca-certificates sudo python3-dev && \
    rm -rf /var/lib/apt/lists*

RUN python3 -m venv /venv
COPY ./requirements.txt ./
RUN pip3 install --upgrade pip && pip3 install --no-cache-dir -r ./requirements.txt

FROM python:3.6-slim-buster AS prod

ENV NLP_USER nlp-api-user
ENV NLP_HOME /home/$NLP_USER
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PYTHONPATH $NLP_HOME
ENV PATH="/venv/bin:$PATH"
ENV UID 1000
ENV GID 1000

RUN groupadd -g $GID $NLP_USER && \
    useradd -u $UID -g $GID -G sudo --create-home --home-dir $NLP_HOME --shell /bin/bash $NLP_USER

WORKDIR $NLP_HOME

COPY --from=builder /venv /venv
COPY --chown=nlp-api-user . $NLP_HOME

USER $NLP_USER

CMD [ "bin/run_server.sh" ]
