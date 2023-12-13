# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.
FROM jupyterhub/singleuser:4.0.2

# Mark this image as "do not delete". We need this to avoid accidentally deleting the image when pruning.
LABEL storage="do_not_delete"

COPY --chown=1000:1000 . /home/jovyan

# Install Python deps
RUN python3 -m pip install -r /home/jovyan/requirements.txt --no-cache-dir

CMD ["/home/jovyan/bootstrap_user.sh"]