import asyncio
import json
import os
import time

from aio_pika import connect
from aio_pika.abc import AbstractIncomingMessage

from app.logs import get_logger

from annotate import annotate_file, annotate_text

RABBITMQ_USER = os.environ.get('RABBITMQ_USER', 'guest')
RABBITMQ_PASSWORD = os.environ.get('RABBITMQ_PASSWORD', 'guest')
ANNOTATOR_QUEUE = os.environ.get('ANNOTATOR_QUEUE', 'annotator_queue')
RABBITMQ_CONNECTION_URL = f'amqp://{RABBITMQ_USER}:{RABBITMQ_PASSWORD}@rabbitmq/'

logger = get_logger()


def _handle_file_annotation(req: dict):
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
        logger.info(f'\tFile ID: {result["file_id"]}\tUser ID: {result["user_id"]}')


def _handle_text_annotation(req: dict):
    try:
        result = annotate_text(
            req['user_id'],
            req['file_id'],
            req['enrichment_mapping'],
            req['raw_enrichment_data'],
            req.get('global_exclusions', None),
            req.get('local_exclusions', None),
            req.get('local_inclusions', None),
            req.get('organism_synonym', None),
            req.get('organism_taxonomy_id', None),
            req.get('annotation_configs', None),
        )
    except KeyError:
        logger.error(f'File annotation request missing required information:')
        logger.error(f'\n\tFile ID: {req.get("file_id", "Missing")}')
        logger.error(f'\n\tUser ID: {req.get("user_id", "Missing")}')
        logger.error(f'\n\tEnrichment Mappings: {req.get("enrichment_mapping", "Missing")}')
        logger.error(f'\n\tEnrichment Data: {req.get("raw_enrichment_data", "Missing")}')
    else:
        logger.info('File successfully annotated!')
        logger.info(f'\tUser ID: {result["user_id"]}')


async def on_message(message: AbstractIncomingMessage) -> None:
    async with message.process():
        logger.info(f' [x] Received message {message!r}')

        try:
            req = json.loads(message.body)
        except json.JSONDecodeError as e:
            logger.error(e)
            logger.error(f'File Annotation Failed: request contained malformed JSON body:')
            logger.error(message.body)
            return
        if 'enrichment_mapping' in req:
            _handle_text_annotation(req)
        else:
            _handle_file_annotation(req)


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

        logger.info('[*] Annotation postbox online, waiting for messages.')
        await asyncio.Future()


if __name__ == '__main__':
    asyncio.run(receive())
