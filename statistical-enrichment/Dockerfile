FROM python:3.9

# Install dependencies
RUN pip install pipenv

# Copy Pipfiles and install dependencies FIRST to better apply Docker layer cache
COPY --chown=1000:1000 Pipfile* .
RUN bash [ -e "Pipfile.lock" ] || pipenv --python python lock
RUN pipenv install --dev --deploy --system

CMD [ "flask", "run", "app" ]
