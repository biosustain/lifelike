#!/bin/bash

# Copyright (c) Jupyter Development Team.
# Distributed under the terms of the Modified BSD License.

# ----------------------------------------------------------------------------

# Start the Bootstrap Process
echo "bootstrap process running ..."

if [ -d "$GDS_DIRECTORY" ]; then
    echo "...directory for GDS already exists. skipped"
else
    echo "...initial content loading for user..."
    cd $JUPYTER_NOTEBOOK_DIR
    wget $GDS_REPO_DOWNLOAD_LINK

    echo "...unzipping content download..."
    python3 /home/jovyan/pyunzip.py main.zip
    rm main.zip
fi

# finally, start the singleuser notebook server
exec /usr/local/bin/start-notebook.sh