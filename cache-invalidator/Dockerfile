FROM python:3.8.3-slim

ENV APP_USER lifelike
ENV APP_HOME /home/$APP_USER
ENV UID 1000
ENV GID 1000

RUN groupadd -g $GID $APP_USER && \
    useradd -u $UID -g $GID -G sudo --create-home --home-dir $APP_HOME --shell /bin/bash $APP_USER

WORKDIR $APP_HOME

RUN pip install pipenv

COPY --chown=1000:1000 Pipfile .
COPY --chown=1000:1000 Pipfile.lock .

RUN pipenv install --deploy --dev --system

COPY --chown=1000:1000 . .

# Don't lose stdin, stdout and stderr output due to buffering
ENV PYTHONUNBUFFERED 1
ENV PYTHONPATH $APP_HOME

USER $APP_USER

CMD ["python", "main.py"]
