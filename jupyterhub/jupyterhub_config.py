# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

# Configuration file for JupyterHub
import os
import nativeauthenticator

c = get_config()  # noqa: F821

# We rely on environment variables to configure JupyterHub so that we
# avoid having to rebuild the JupyterHub container every time we change a
# configuration parameter.

# Spawn single-user servers as Docker containers
c.JupyterHub.spawner_class = "dockerspawner.DockerSpawner"

# Spawn containers from this image
c.DockerSpawner.image = os.environ["JUPYTER_NOTEBOOK_IMAGE"]

# Connect containers to this Docker network
network_name = os.environ["JUPYTER_NETWORK_NAME"]
c.DockerSpawner.use_internal_ip = True
c.DockerSpawner.network_name = network_name
c.DockerSpawner.extra_host_config = { 'network_mode': network_name }

# Explicitly set notebook directory because we"ll be mounting a volume to it.
# Most `jupyter/docker-stacks` *-notebook images run the Notebook server as
# user `jovyan`, and set the notebook directory to `/home/jovyan/work`.
# We follow the same convention.
notebook_dir = os.environ.get("JUPYTER_NOTEBOOK_DIR", "/home/jovyan/work")
c.DockerSpawner.notebook_dir = notebook_dir

# Mount the real user's Docker volume on the host to the notebook user's
# notebook directory in the container
c.DockerSpawner.volumes = c.DockerSpawner.volumes = {
    "jupyterhub-user-{username}": notebook_dir,
}

# Remove containers once they are stopped
c.DockerSpawner.remove = True

# For debugging arguments passed to spawned containers
c.DockerSpawner.debug = True

# User containers will access hub by container name on the Docker network
c.JupyterHub.hub_ip = "jupyterhub"
c.JupyterHub.hub_port = 8080

# Persist hub data on volume mounted inside container
c.JupyterHub.cookie_secret_file = "/data/jupyterhub_cookie_secret"
c.JupyterHub.db_url = "sqlite:////data/jupyterhub.sqlite"

# Authenticate users with Native Authenticator
c.JupyterHub.authenticator_class = "nativeauthenticator.NativeAuthenticator"

# Required for some UI elements to appear in the browser
c.JupyterHub.template_paths = [f"{os.path.dirname(nativeauthenticator.__file__)}/templates/"]

# Extra environment variables the user container should inherit
c.Spawner.environment = {
    "JUPYTER_NOTEBOOK_DIR" : os.environ["JUPYTER_NOTEBOOK_DIR"],
    "GDS_DIRECTORY": f'{os.environ["JUPYTER_NOTEBOOK_DIR"]}/{os.environ["GDS_REPO_NAME"]}',
    "GDS_REPO_DOWNLOAD_LINK": os.environ["GDS_REPO_DOWNLOAD_LINK"],
    "DEFAULT_GDS_ARANGO_URI": os.environ["DEFAULT_GDS_ARANGO_URI"],
    "DEFAULT_GDS_ARANGO_USERNAME": os.environ["DEFAULT_GDS_ARANGO_USERNAME"],
    "DEFAULT_GDS_PASSWORD": os.environ["DEFAULT_GDS_PASSWORD"],
    "DEFAULT_GDS_ARANGO_DBNAME": os.environ["DEFAULT_GDS_ARANGO_DBNAME"]
}

# Allowed admins
admin = os.environ.get("JUPYTERHUB_ADMIN")
if admin:
    c.Authenticator.admin_users = [admin]
