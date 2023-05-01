FROM python:3.9-buster
LABEL app=annotator

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

WORKDIR $_HOME

# Copy Pipfiles and install dependencies FIRST to better apply Docker layer cache
COPY --chown=$UID:$GID Pipfile .
COPY --chown=$UID:$GID Pipfile.lock .

RUN pipenv install --dev --deploy --system

COPY --chown=$UID:$GID . .

ENV PYTHONPATH $_HOME

USER $_USER

CMD [ "python3", "postbox.py" ]
