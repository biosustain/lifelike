import asyncio
import json
import os
import time

from aio_pika import connect
from aio_pika.abc import AbstractIncomingMessage

from app.constants import BULK_DELETE_OP, BULK_INDEX_OP, BULK_UPDATE_OP
from app.elastic_service import (
    streaming_bulk_delete_files,
    streaming_bulk_index_files,
    streaming_bulk_update_files
)
from app.logs import get_logger


# Get RabbitMQ vars
RMQ_MESSENGER_USERNAME = os.environ.get('RMQ_MESSENGER_USERNAME', 'messenger')
RMQ_MESSENGER_PASSWORD = os.environ.get('RMQ_MESSENGER_PASSWORD', 'password')
ELASTIC_INDEXER_QUEUE = os.environ.get('ELASTIC_INDEXER_QUEUE', 'elastic_indexer')
RABBITMQ_CONNECTION_URL = f'amqp://{RMQ_MESSENGER_USERNAME}:{RMQ_MESSENGER_PASSWORD}@rabbitmq/'

logger = get_logger()


async def _handle_bulk_index_op(request: dict):
    logger.info('Bulk index operation requested.')
    await streaming_bulk_index_files(request['sources'])


async def _handle_bulk_update_op(request: dict):
    logger.info('Bulk update operation requested.')
    await streaming_bulk_update_files(request['updates'])


async def _handle_bulk_delete_op(request: dict):
    logger.info('Bulk delete operation requested.')
    await streaming_bulk_delete_files(request['file_hash_ids'])


async def _handle_request(request):
    try:
        op_type = request['op_type']

        if op_type == BULK_INDEX_OP:
            await _handle_bulk_index_op(request)
        if op_type == BULK_UPDATE_OP:
            await _handle_bulk_update_op(request)
        if op_type == BULK_DELETE_OP:
            await _handle_bulk_delete_op(request)

    except KeyError as e:
        logger.error(e, exc_info=True)
        logger.error('Elasticsearch operation failed. Unknown operation type.')
        raise


async def on_message(message: AbstractIncomingMessage) -> None:
    logger.info(f' [x] Received message {message!r}')

    try:
        try:
            request = json.loads(message.body)
            logger.debug(json.dumps(request, indent=4))

            await _handle_request(request)
        except json.JSONDecodeError as e:
            logger.error(e, exc_info=True)
            logger.error('Elasticsearch operation failed. Request contained malformed JSON body:')
            logger.error(message.body)
            raise
    except Exception as e:
        logger.error(e, exc_info=True)
        logger.error('Elasticsearch operation failed. Unhandled error occurred. Request object:')
        logger.error(json.dumps(request, indent=4))
        await message.reject(requeue=False)
    else:
        logger.info('Elasticsearch operation successfully completed.')
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
        queue = await channel.get_queue(ELASTIC_INDEXER_QUEUE)

        # Start listening to the queue
        await queue.consume(on_message)

        logger.info('[*] Postbox online, waiting for messages.')
        await asyncio.Future()


if __name__ == '__main__':
    asyncio.run(receive())
