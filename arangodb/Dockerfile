# Note that the arango image uses Linux Alpine as its base
FROM arangodb:3.9 as base

# Create a group and user
RUN addgroup -S arangogroup && adduser -S dbuser -G arangogroup

# Tell docker that all future commands should run as dbuser
USER dbuser

# Switch to dbuser directory
ENV DB_HOME /home/dbuser
WORKDIR $DB_HOME

# Copy shell scripts into user dir
COPY bin ./bin
