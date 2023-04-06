import asyncio
import json
import os
import time

from aio_pika import connect
from aio_pika.abc import AbstractIncomingMessage

from app.logs import setup_annotator_logging

from annotate import annotate_file

RABBITMQ_USER = os.environ.get('RABBITMQ_USER', 'guest')
RABBITMQ_PASSWORD = os.environ.get('RABBITMQ_PASSWORD', 'guest')
ANNOTATOR_QUEUE = os.environ.get('ANNOTATOR_QUEUE', 'annotator_queue')
RABBITMQ_CONNECTION_URL = f'amqp://{RABBITMQ_USER}:{RABBITMQ_PASSWORD}@rabbitmq/'

logger = setup_annotator_logging()


async def on_message(message: AbstractIncomingMessage) -> None:
    async with message.process():
        logger.info(f' [x] Received message {message!r}')

        try:
            req = json.loads(message.body)
        except json.JSONDecodeError as e:
            logger.error(e)
            logger.error(f'File annotation request contained malformed JSON body:\n{message.body}')
            return
        try:
            result = annotate_file(
                req['user_id'],
                req['file_id'],
                req.get('global_exclusions', None),
                req.get('local_exclusions', None),
                req.get('local_inclusions', None),
                req.get('organism_synonym', None),
                req.get('organism_taxonomy_id', None),
                req.get('annotation_configs', None),
            )
        except KeyError:
            logger.error(
                f'File annotation request missing required information:' +
                f'\n\tFile ID: {req.get("file_id", None)}' +
                f'\n\tUser ID: {req.get("user_id", None)}'
            )
        else:
            logger.info('File successfully annotated!')
            logger.info(f'File ID: {result["file_id"]}\tUser ID: {result["user_id"]}')


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
        queue = await channel.declare_queue(
            ANNOTATOR_QUEUE,
            # Declares this queue as persistent
            durable=True,
        )

        # Start listening to the queue
        await queue.consume(on_message)

        logger.info(' [*] Waiting for messages. To exit press CTRL+C')
        await asyncio.Future()


if __name__ == '__main__':
    asyncio.run(receive())
