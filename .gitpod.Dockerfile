FROM gitpod/workspace-full

ARG BASE_DOTFILES_URL="https://raw.githubusercontent.com/dreglad/gitpod-dotfiles/master"

USER gitpod

# Install CLI tools
ADD --chown=gitpod ${BASE_DOTFILES_URL}/scripts/gcloud_cli_install.sh ./gcloud_cli_install.sh
RUN chmod +x ./gcloud_cli_install.sh && ./gcloud_cli_install.sh

# crcmod for faster GCP transfers
RUN sudo apt-get install --yes gcc python3-dev python3-setuptools && \
    sudo pip3 uninstall crcmod && \
    sudo pip3 install --no-cache-dir -U crcmod

# Linuxbrew packages
RUN sudo brew install gh figlet hasura-cli kubectl helm helmfile

# Shell config & completion
RUN npm completion >> ~/.bashrc && npm completion >> ~/.zshrc
