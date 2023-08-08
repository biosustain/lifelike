import asyncio
import json
import os
import time

from aio_pika import connect
from aio_pika.abc import AbstractIncomingMessage

from app.handle_message import update_tables
from app.logs import get_logger


# Get RabbitMQ vars
RMQ_MESSENGER_USERNAME = os.environ.get('RMQ_MESSENGER_USERNAME', 'messenger')
RMQ_MESSENGER_PASSWORD = os.environ.get('RMQ_MESSENGER_PASSWORD', 'password')
POST_ANNOTATOR_QUEUE = os.environ.get('POST_ANNOTATOR_QUEUE', 'post_annotator')
RABBITMQ_CONNECTION_URL = (
    f'amqp://{RMQ_MESSENGER_USERNAME}:{RMQ_MESSENGER_PASSWORD}@rabbitmq/'
)

logger = get_logger()


async def on_message(message: AbstractIncomingMessage) -> None:
    logger.info(f' [x] Received message {message!r}')

    try:
        try:
            request = json.loads(message.body)
            logger.debug(json.dumps(request, indent=4))
        except json.JSONDecodeError as e:
            logger.error(e, exc_info=True)
            logger.error(
                'File Annotation Post Processing Failed. '
                + 'Request contained malformed JSON body:'
            )
            logger.error(message.body)
            raise
        file_hash_id, file_annotations_version_hash_id = update_tables(request)
    except Exception as e:
        logger.error(e, exc_info=True)
        logger.error(
            'File Annotation Post Processing Failed. Unhandled exception occurred. '
            + 'Request object:'
        )
        logger.error(json.dumps(request, indent=4))
        await message.reject(requeue=False)
    else:
        logger.info('Annotations successfully post-processed:')
        logger.info(f'\t\tFile Hash ID: {file_hash_id}')
        logger.info(
            f'\t\tFile Annotations Version Hash ID: {file_annotations_version_hash_id}'
        )
        await message.ack()


async def receive() -> None:
    # Perform connection
    connection_secured = False
    while not connection_secured:
        try:
            connection = await connect(RABBITMQ_CONNECTION_URL)
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
        queue = await channel.get_queue(POST_ANNOTATOR_QUEUE)

        # Start listening to the queue
        await queue.consume(on_message)

        logger.info('[*] Postbox online, waiting for messages.')
        await asyncio.Future()


if __name__ == '__main__':
    asyncio.run(receive())
