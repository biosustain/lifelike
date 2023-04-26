import json

from aio_pika import DeliveryMode, Message, connect
from flask import current_app


async def send(body: dict, queue: str) -> None:
    # Perform connection
    connection = await connect(current_app.config.get('RABBITMQ_CONNECTION_URL'))

    async with connection:
        # Creating a channel
        channel = await connection.channel()

        message = Message(
            json.dumps(body).encode('utf-8'),
            # Ensure the message is durable
            delivery_mode=DeliveryMode.PERSISTENT,
        )

        # Sending the message
        await channel.default_exchange.publish(
            message,
            routing_key=queue,
        )

        current_app.logger.info(f' [x] Sent {message!r}')
