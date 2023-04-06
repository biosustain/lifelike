#!/bin/sh

# Admin vars
sed -i "s/__ADMIN_USERNAME__/${RMQ_ADMIN_USERNAME}/" /etc/rabbitmq/definitions.json
sed -i "s/__ADMIN_PASSWORD__/${RMQ_ADMIN_PASSWORD}/" /etc/rabbitmq/definitions.json

# Messenger vars
sed -i "s/__MESSENGER_USERNAME__/${RMQ_MESSENGER_USERNAME}/" /etc/rabbitmq/definitions.json
sed -i "s/__MESSENGER_PASSWORD__/${RMQ_MESSENGER_PASSWORD}/" /etc/rabbitmq/definitions.json

# Run the original entrypoint once we're done with any init work.
exec /usr/local/bin/docker-entrypoint.sh "$@"