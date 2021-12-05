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


# ========================================
# Angular app dependencies
# ========================================
FROM $NODE_IMAGE_TAG as angular-deps
WORKDIR /app

# build time argument for Angular environment
ARG ANGULAR_CONFIG=production

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn Install


# ========================================
# Angular app bundle build
# ========================================
FROM $NODE_IMAGE_TAG as angular-build

# Copy node_nodules
COPY --from=angular-deps /app/node_modules ./

# Copy the code and Build the app bundle
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
ENV LIFELIKE_CONTENT_TYPES vnd.lifelike.document/bioc vnd.lifelike.document/enrichment-table vnd.lifelike.document/graph vnd.lifelike.document/map

# Copy nginx configuraiton template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy built assets
COPY --from=landing-build /app/dist ./
COPY --from=angular-build /app/dist ./

EXPOSE 80
