FROM python:3.9-buster

ENV _USER user
ENV _HOME /home/$_USER
ENV UID 1000
ENV GID 1000

# Root acces only if in ***ARANGO_USERNAME*** group
RUN echo "auth required pam_wheel.so" >> /etc/pam.d/su

# Install dependencies
RUN pip install pipenv

# User and group creation
RUN addgroup --system wheel && \
    groupadd -g $GID $_USER && \
    useradd -u $UID -g $GID -G wheel --create-home --shell /bin/bash $_USER

USER $_USER
WORKDIR $_HOME

# Copy Pipfiles and install dependencies FIRST to better apply Docker layer cache
COPY --chown=$UID:$GID Pipfile* .
RUN ([ -f "Pipfile.lock" ] || pipenv --python python lock)
RUN pipenv install --dev --deploy --system -vvv

ENV FLASK_APP=statistical_enrichment

COPY --chown=$UID:$GID statistical_enrichment .
COPY --chown=$UID:$GID bin .

CMD [ "bin/startup.sh" ]
