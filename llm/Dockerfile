FROM python:3.11 as base
LABEL app=kg-prototypes

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

FROM base as lock

COPY --chown=$UID:$GID . .

CMD [ "pipenv", "lock" ]

FROM base as build

COPY --chown=$UID:$GID Pipfile.lock .

ENV FLASK_APP=llm

FROM build as dev

# Copy files first so pipenv can link to editable package
COPY --chown=$UID:$GID . .

# Install dev dependencies
# (NOTE: cannot run after `pipenv install` - https://github.com/pypa/pipenv/issues/4435)
RUN pipenv install --dev --deploy --system

COPY --chown=$UID:$GID . .

USER $_USER

# Jupyter Notebook
EXPOSE 8888

FROM build as prod

RUN pipenv install --deploy --system

COPY --chown=$UID:$GID . .

USER $_USER

CMD [ "bin/startup.sh" ]
