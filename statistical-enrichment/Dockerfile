FROM python:3.9-buster

WORKDIR code

# Install dependencies
RUN pip install pipenv

# Copy Pipfiles and install dependencies FIRST to better apply Docker layer cache
COPY --chown=1000:1000 Pipfile* .
RUN ([ -f "Pipfile.lock" ] || pipenv --python python lock)
RUN pipenv install --dev --deploy --system -vvv

ENV FLASK_APP=statistical_enrichment

COPY statistical_enrichment .
COPY bin .

USER $N4J_USER

CMD [ "bin/startup.sh" ]
