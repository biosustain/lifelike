FROM node:slim

# Install git to check for private git pkgs
RUN apt-get update && apt-get install -y git \
    && rm -rf /var/lib/apt/lists/*

ENV N4J_USER node
ENV N4J_HOME /home/$N4J_USER
ENV N4J_CLIENT $N4J_HOME/client

ENV PATH $N4J_CLIENT/node_modules/.bin:$PATH

WORKDIR $N4J_CLIENT
USER $N4J_USER

COPY . $N4J_CLIENT
