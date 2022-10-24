FROM gitpod/workspace-full

ARG BASE_DOTFILES_URL="https://raw.githubusercontent.com/dreglad/gitpod-dotfiles/master"

# Install CLI tools
ADD --chown=gitpod ${BASE_DOTFILES_URL}/scripts/gcloud_cli_install.sh ./gcloud_cli_install.sh
RUN chmod +x ./gcloud_cli_install.sh && ./gcloud_cli_install.sh

# Install AWS tools
ADD --chown=gitpod ${BASE_DOTFILES_URL}/scripts/awscli_install.sh ./awscli_install.sh
RUN chmod +x ./awscli_install.sh && ./awscli_install.sh
