FROM node:slim

ENV N4J_USER node
ENV N4J_HOME /home/$N4J_USER
ENV N4J_CLIENT $N4J_HOME/client

# Used for executables (i.e. angular-cli)
ENV PATH $N4J_CLIENT/node_modules/.bin:$PATH

COPY . $N4J_CLIENT
WORKDIR $N4J_CLIENT
USER $N4J_USER
