#!/bin/bash

# Add expected environment variables here as necessary
declare -a arr=(
    "ANNOTATOR_QUEUE"
    "POST_ANNOTATOR_QUEUE"
    "RMQ_ADMIN_USERNAME"
    "RMQ_ADMIN_PASSWORD"
    "RMQ_MESSENGER_USERNAME"
    "RMQ_MESSENGER_PASSWORD"
)

for varname in "${arr[@]}"
do
    varval=$(eval "echo \$${varname}")
    sed -i "s/__${varname}__/${varval}/" /etc/rabbitmq/definitions.json
done

# Run the original entrypoint once we're done with any init work.
exec /usr/local/bin/docker-entrypoint.sh "$@"