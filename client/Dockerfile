FROM node:slim

# Install psql to check on postgres availability
RUN apt-get update && apt-get install -y git

ENV N4J_USER ***ARANGO_USERNAME***
ENV N4J_HOME /home/$N4J_USER
ENV N4J_CLIENT $N4J_HOME/client

WORKDIR $N4J_CLIENT
USER $N4J_USER

# install and cache app dependencies
COPY package.json $N4J_CLIENT/package.json

COPY toolbar-menu/ $N4J_CLIENT/toolbar-menu

RUN yarn global add @angular/cli@7.3.9
RUN yarn

COPY . $N4J_CLIENT
