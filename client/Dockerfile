ARG NODE_IMAGE_TAG=node:14

# ========================================
# Angular app dependencies
# ========================================
FROM $NODE_IMAGE_TAG as angular-deps
WORKDIR /app

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install


# ========================================
# Angular app bundle build
# ========================================
FROM angular-deps as angular-build

# build time argument for Angular environment
ARG ANGULAR_CONFIG=production

# Copy the code and build the app bundle
COPY src ./src
COPY tslint ./tslint
COPY e2e ./e2e
COPY *.json browserslist ./
RUN yarn build --configuration=$ANGULAR_CONFIG --aot --output-path=dist


# ========================================
# Runtime stage - NGINX
# ========================================
FROM nginx:1.21
LABEL app=kg-prototypes
WORKDIR /usr/share/nginx/html

# URL to proxy requests to /api
ENV APPSERVER_UPSTREAM http://appserver:5000

# List of space delimited list of non-stantdard MIME types
# which are known to benefit from gzip compression (text based content)
ENV GZIP_EXTRA_TYPES text/tsv vnd.***ARANGO_DB_NAME***.document/bioc vnd.***ARANGO_DB_NAME***.document/enrichment-table vnd.***ARANGO_DB_NAME***.document/graph vnd.***ARANGO_DB_NAME***.document/map

# Copy nginx configuraiton template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy built assets
COPY --from=angular-build /app/dist ./

EXPOSE 80
