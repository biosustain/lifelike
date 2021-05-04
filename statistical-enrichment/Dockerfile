FROM python:3.9

WORKDIR code

# Install dependencies
RUN pip install pipenv

# Copy Pipfiles and install dependencies FIRST to better apply Docker layer cache
COPY --chown=1000:1000 Pipfile* .
RUN ([ -f "Pipfile.lock" ] || pipenv --python python lock)
RUN pipenv install --dev --deploy --system

ENV FLASK_APP=statistical_enrichment

CMD [ "flask", "run", "-h", "0.0.0.0", "-p", "80" ]
