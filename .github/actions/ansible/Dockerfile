FROM python:3.9.4-slim-buster

# Install required APT packages
RUN apt-get update && apt-get install -y \
    curl build-essential gettext-base jq \
    apt-transport-https gnupg curl lsb-release

# Install gcloud (https://stackoverflow.com/a/53501128)
RUN export CLOUD_SDK_REPO="cloud-sdk-$(lsb_release -c -s)" && \
  echo "cloud SDK repo: $CLOUD_SDK_REPO" && \
  echo "deb http://packages.cloud.google.com/apt $CLOUD_SDK_REPO main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list && \
  curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add - && \
  apt-get update -y && apt-get install -y google-cloud-sdk

# Upgrade pip & install Ansible
 RUN python -m pip install --upgrade pip \
   && pip install ansible requests google-auth

# Ansible configuration variables
ENV ANSIBLE_HOST_KEY_CHECKING=False

# Install Ansible GCP modules
RUN ansible-galaxy collection install google.cloud

# Copy Docker entrypoint
COPY entrypoint.sh entrypoint.sh
RUN chmod +x entrypoint.sh

ENTRYPOINT [ "entrypoint.sh" ]
