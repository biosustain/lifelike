# TODO: Consider using a smaller image for deployment, using the base image to
# enable installing Chrome for Karma testing
FROM node:13.10.1

# OPTIONAL: Install dumb-init (Very handy for easier signal handling of SIGINT/SIGTERM/SIGKILL etc.)
RUN wget https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64.deb
RUN dpkg -i dumb-init_*.deb
ENTRYPOINT ["dumb-init"]

# Install Google Chrome (for Karma testing)
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
RUN apt-get update && apt-get install -y google-chrome-stable

# Clean up the image cache (see the Docker best practices guide: https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#run)
RUN apt-get autoclean && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

ENV N4J_USER node
ENV N4J_HOME /home/$N4J_USER
ENV N4J_CLIENT $N4J_HOME/client

ENV PATH $N4J_CLIENT/node_modules/.bin:$PATH

WORKDIR $N4J_CLIENT

COPY --chown=$N4J_USER:$N4J_USER package.json $N4J_CLIENT/package.json
COPY --chown=$N4J_USER:$N4J_USER yarn.lock $N4J_CLIENT/yarn.lock
RUN yarn install && chown -R $N4J_USER:$N4J_USER node_modules

USER $N4J_USER

COPY . $N4J_CLIENT
