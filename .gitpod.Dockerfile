FROM gitpod/workspace-full

ARG BASE_DOTFILES_URL="https://raw.githubusercontent.com/dreglad/gitpod-dotfiles/master"

# Install CLI tools
ADD --chown=gitpod ${BASE_DOTFILES_URL}/scripts/gcloud_cli_install.sh ./gcloud_cli_install.sh
RUN chmod +x ./gcloud_cli_install.sh && ./gcloud_cli_install.sh

# APT packages
RUN apt-get install kubectl redis-server --yes

# Liniuxbrew packages
RUN brew install gh terraform figlet hasura-cli postgresql@14 k9s \
    helm helmfile

# Shell config & completion
RUN npm completion >> ~/.bashrc && npm completion >> ~/.zshrc
RUN kubectl completion bash > ~/.kube/completion.bash.inc
RUN echo "source \"$HOME/.kube/completion.bash.inc\"" >> $HOME/.bash_profile
