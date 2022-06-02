ARG NODE_IMAGE_TAG=node:14

# ========================================
# Landing page
# ========================================
FROM $NODE_IMAGE_TAG as landing-build
WORKDIR /app

# Install dependencies
COPY landing/package.json landing/yarn.lock ./
RUN yarn install

# Build landing page
COPY landing ./
RUN yarn build


# ==================================================================
# Angular app dependencies by default used for local development
# ==================================================================
FROM $NODE_IMAGE_TAG as angular-deps
WORKDIR /app

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install

# build time arguments for Angular environment
ARG ANGULAR_CONFIG=development
ARG CLIENT_VERSION=undefined
# default enviroment presets
ENV ENVIRONMENT_CONFIG $ANGULAR_CONFIG

# ========================================
# Angular app bundle build
# ========================================
FROM angular-deps as angular-build

# build time arguments for Angular environment
ARG ANGULAR_CONFIG=production
ARG CLIENT_VERSION=undefined

# Copy the code and build the app bundle
COPY src ./src
COPY tslint ./tslint
COPY e2e ./e2e
COPY *.json browserslist ./
RUN sed -i "s/__VERSION__/${CLIENT_VERSION}/" src/environments/environment.ts
RUN yarn build --configuration=$ANGULAR_CONFIG --aot --output-path=dist

# ========================================
# Runtime stage - NGINX
# ========================================
FROM nginx:1.21
LABEL app=kg-prototypes
WORKDIR /usr/share/nginx/html

# URL to proxy requests to /api
ENV APPSERVER_UPSTREAM http://appserver:5000

# Whether to run the app in prod mode
ENV PRODUCTION_MODE true

# Whether to run the app with oauth login
ENV OAUTH_ENABLED false

# OAuth issuer discovert URL
ENV OAUTH_ISSUER ""

# Client ID of the OAuth application
ENV OAUTH_CLIENT_ID ""

# List of space delimited list of non-stantdard MIME types
# which are known to benefit from gzip compression (text based content)
ENV GZIP_EXTRA_TYPES text/tsv vnd.***ARANGO_DB_NAME***.document/bioc vnd.***ARANGO_DB_NAME***.document/enrichment-table vnd.***ARANGO_DB_NAME***.document/graph vnd.***ARANGO_DB_NAME***.document/map

# build time argument for Angular environment
ARG ANGULAR_CONFIG=production

# default enviroment presets
ENV ENVIRONMENT_CONFIG $ANGULAR_CONFIG

# Copy nginx configuraiton template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy built assets
COPY --from=landing-build /app/dist ./
COPY --from=angular-build /app/dist ./

EXPOSE 80
