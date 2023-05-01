#!/bin/bash

envsubst < /etc/rabbitmq/definitions.json > /etc/rabbitmq/tmp.txt
mv /etc/rabbitmq/tmp.txt /etc/rabbitmq/definitions.json

# Run the original entrypoint once we're done with any init work.
exec /usr/local/bin/docker-entrypoint.sh "$@"