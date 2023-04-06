import asyncio
import time

from aio_pika import connect
from aio_pika.abc import AbstractIncomingMessage

from app.logs import setup_annotator_logging

logger = setup_annotator_logging()


async def on_message(message: AbstractIncomingMessage) -> None:
    async with message.process():
        print(f' [x] Received message {message!r}')
        await asyncio.sleep(message.body.count(b'.') * 5)
        print(f'     Message body is: {message.body!r}')


async def receive() -> None:
    # Perform connection
    connection_secured = False
    while not connection_secured:
        try:
            connection = await connect('amqp://guest:guest@rabbitmq/')
            connection_secured = True
        except Exception as e:
            logger.warning(f'RabbitMQ Connection failed: {e}. Retrying in 5s...')
            time.sleep(5)

    async with connection:
        # Creating a channel
        channel = await connection.channel()
        await channel.set_qos(
            # Do not give more than one message to a worker at a time. I.e., give any incoming
            # tasks to the next idle worker.
            prefetch_count=1
        )

        # Declaring queue
        queue = await channel.declare_queue(
            'task_queue',
            # Declares this queue as persistent
            durable=True,
        )

        # Start listening the queue with name 'task_queue'
        await queue.consume(on_message)

        print(' [*] Waiting for messages. To exit press CTRL+C')
        await asyncio.Future()


if __name__ == '__main__':
    asyncio.run(receive())
