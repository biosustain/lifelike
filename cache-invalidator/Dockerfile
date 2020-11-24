FROM python:3.8.3-slim

RUN pip install pipenv

WORKDIR /app

COPY --chown=1000:1000 Pipfile .
COPY --chown=1000:1000 Pipfile.lock .

RUN pipenv install --deploy --system

COPY --chown=1000:1000 . .

# Don't lose stdin, stdout and stderr output due to buffering
ENV PYTHONUNBUFFERED 1

CMD ["python", "main.py"]
