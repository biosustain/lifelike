#!/bin/bash

echo "Waiting for Arango"

ARANGO_STATUS="000"

until [ "$ARANGO_STATUS" = "200" ]
do
    ARANGO_STATUS=`curl -s -o /dev/null -I -w "%{http_code}" --basic --user "${ARANGO_USERNAME}:${ARANGO_PASSWORD}" -X GET ${ARANGO_HOST}/_api/endpoint`
    echo "Status of Arango: $ARANGO_STATUS"
    sleep 2
done

# Run command | https://docs.docker.com/compose/startup-order/
>&2 echo "Arango started - executing command"
exec $@