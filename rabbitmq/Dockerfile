FROM rabbitmq:3.11-management AS base

ADD ./rabbitmq.conf /etc/rabbitmq/rabbitmq.conf
ADD ./definitions.json /etc/rabbitmq/definitions.json

COPY custom-entrypoint.sh /custom-entrypoint.sh
RUN chmod +x /custom-entrypoint.sh

ENTRYPOINT ["/custom-entrypoint.sh"]

EXPOSE 4369 5671 5672 15691 15692 25672
CMD ["rabbitmq-server"]
