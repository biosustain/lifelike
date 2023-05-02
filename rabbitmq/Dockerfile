FROM rabbitmq:3.11-management AS base

RUN apt-get update && apt-get install -y gettext-base curl && apt-get clean

ADD ./rabbitmq.conf /etc/rabbitmq/rabbitmq.conf
ADD ./definitions.json /etc/rabbitmq/definitions.json

COPY custom-entrypoint.sh /custom-entrypoint.sh
RUN chmod +x /custom-entrypoint.sh

HEALTHCHECK --interval=5s --timeout=30s --start-period=5s --retries=6 CMD curl -f http://rabbitmq:15672 || exit 1

ENTRYPOINT ["/custom-entrypoint.sh"]

EXPOSE 4369 5671 5672 15691 15692 25672
CMD ["rabbitmq-server"]
