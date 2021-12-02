FROM node:13.10.1 as base

# ========================================
# Landing page
# ========================================
FROM base as landing

ENV CLIENT_USER node
ENV CLIENT_HOME /home/$CLIENT_USER
ENV LANDING_DIR $CLIENT_HOME/client/landing

ENV PATH $LANDING_DIR/node_modules/.bin:$PATH

WORKDIR $LANDING_DIR

COPY --chown=$CLIENT_USER:$CLIENT_USER landing/package.json .
COPY --chown=$CLIENT_USER:$CLIENT_USER landing/yarn.lock .
RUN yarn install \
    && chown -R $CLIENT_USER:$CLIENT_USER node_modules

COPY landing .
RUN yarn build


# ========================================
# Angular app
# ========================================
FROM base as build

# OPTIONAL: Install dumb-init (Very handy for easier signal handling of SIGINT/SIGTERM/SIGKILL etc.)
RUN wget https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64.deb \
    && dpkg -i dumb-init_*.deb
ENTRYPOINT ["dumb-init"]

# Install Google Chrome (for Karma testing)
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
# Clean up the image cache (see the Docker best practices guide: https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#run)
RUN apt-get update \
    && apt-get install -y google-chrome-stable \
    && apt-get autoclean \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

ENV CLIENT_USER node
ENV CLIENT_HOME /home/$CLIENT_USER
ENV ANGULAR_DIR $CLIENT_HOME/client

ENV PATH $ANGULAR_DIR/node_modules/.bin:$PATH

WORKDIR $ANGULAR_DIR

COPY --chown=$CLIENT_USER:$CLIENT_USER package.json .
COPY --chown=$CLIENT_USER:$CLIENT_USER yarn.lock .
RUN yarn install \
    && chown -R $CLIENT_USER:$CLIENT_USER node_modules

# Copy the rest of the files
COPY . .


# ========================================
# Angular bundle compilation
# ========================================
FROM build as compile

ENV CLIENT_USER node
ENV CLIENT_HOME /home/$CLIENT_USER
ENV ANGULAR_DIR $CLIENT_HOME/client
ENV PATH $ANGULAR_DIR/node_modules/.bin:$PATH
ARG ANGULAR_CONFIG=production

WORKDIR $ANGULAR_DIR
COPY --from=build /home/node/client .
RUN yarn build --configuration=$ANGULAR_CONFIG --output-path=dist

# ========================================
# NGINX
# ========================================
FROM nginx:1.21 AS webserver
LABEL app=kg-prototypes

COPY --from=compile /home/node/client/dist .
COPY --from=landing /home/node/client/landing/dist .

COPY nginx/nginx.conf /etc/nginx/templates/default.conf.template
RUN rm /etc/nginx/conf.d/default.conf

# URL to proxy requests to /api
ENV APPSERVER_UPSTREAM http://appserver:5000
ENV LIFELIKE_CONTENT_TYPES vnd.lifelike.document/bioc vnd.lifelike.document/enrichment-table vnd.lifelike.document/graph vnd.lifelike.document/map

EXPOSE 80
