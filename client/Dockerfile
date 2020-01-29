FROM node:slim

ENV N4J_USER node
ENV N4J_HOME /home/$N4J_USER
ENV N4J_CLIENT $N4J_HOME/client

# Used for executables (i.e. angular-cli)
ENV PATH $N4J_HOME/node_modules/.bin:$PATH

# Load node_modules in home directory so they will
# not be affected by the source directory. Symlink
# will be used to them together.
COPY ./package.json $N4J_HOME/
COPY ./yarn.lock $N4J_HOME/
COPY ./toolbar-menu $N4J_HOME/

WORKDIR $N4J_HOME
RUN yarn install && rm package.json && rm -f toolbar-menu

COPY . $N4J_CLIENT
WORKDIR $N4J_CLIENT
USER $N4J_USER
