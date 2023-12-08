# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
# ARG JUPYTERHUB_VERSION
FROM quay.io/jupyterhub/jupyterhub:latest

# Install dockerspawner, nativeauthenticator
# hadolint ignore=DL3013
RUN python3 -m pip install --no-cache-dir \
    dockerspawner \
    jupyterhub-nativeauthenticator

COPY --chown=1000:1000 . /srv/jupyterhub

CMD ["jupyterhub", "-f", "/srv/jupyterhub/jupyterhub_config.py"]
