import asyncio
import json
import os
import time

from aio_pika import Channel, DeliveryMode, Message, connect_robust
from aio_pika.pool import Pool

from app.logs import get_logger

from app.annotate import annotate_file, annotate_text

RABBITMQ_USER = os.environ.get('RABBITMQ_USER', 'guest')
RABBITMQ_PASSWORD = os.environ.get('RABBITMQ_PASSWORD', 'guest')
ANNOTATOR_QUEUE = os.environ.get('ANNOTATOR_QUEUE', 'annotator_queue')
POST_ANNOTATOR_QUEUE = os.environ.get('POST_ANNOTATOR_QUEUE', 'post_annotator_queue')
RABBITMQ_CONNECTION_URL = f'amqp://{RABBITMQ_USER}:{RABBITMQ_PASSWORD}@rabbitmq/'

logger = get_logger()


def _handle_file_annotation(req: dict):
    try:
        result = annotate_file(
            req['file_id'],
            req.get('global_exclusions', None),
            req.get('local_exclusions', None),
            req.get('local_inclusions', None),
            req.get('organism_synonym', None),
            req.get('organism_taxonomy_id', None),
            req.get('annotation_configs', None),
        )
    except KeyError:
        logger.error('File annotation request missing required information:')
        logger.error(f'\t\tFile ID: {req.get("file_id", None)}')
        raise
    else:
        logger.info('File successfully annotated!')
        logger.info(f'\t\tFile ID: {result["file_id"]}')
        return result


def _handle_text_annotation(req: dict):
    try:
        result = annotate_text(
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
        logger.error(f'\t\tFile ID: {req.get("file_id", "Missing")}')
        logger.error(f'\t\tEnrichment Mappings: {req.get("enrichment_mapping", "Missing")}')
        logger.error(f'\t\tEnrichment Data: {req.get("raw_enrichment_data", "Missing")}')
        raise
    else:
        logger.info('File successfully annotated!')
        logger.info(f'\t\tFile ID: {result["file_id"]}')
        return result


async def main():
    loop = asyncio.get_event_loop()

    async def get_connection():
        # Perform connection
        while True:
            try:
                return await connect_robust(RABBITMQ_CONNECTION_URL)
            except Exception as e:
                logger.warning(f'RabbitMQ Connection failed: {e}. Retrying in 5s...')
                time.sleep(5)

    connection_pool = Pool(get_connection, max_size=2, loop=loop)

    async def get_channel() -> Channel:
        async with connection_pool.acquire() as connection:
            return await connection.channel()

    channel_pool = Pool(get_channel, max_size=10, loop=loop)

    async def consume() -> None:
        async with channel_pool.acquire() as channel:  # type: aio_pika.Channel
            logger.info('[*] Postbox online on new channel, waiting for messages.')
            while True:
                await channel.set_qos(10)

                queue = await channel.declare_queue(
                    ANNOTATOR_QUEUE,
                    durable=True,
                    auto_delete=False
                )
                async with queue.iterator() as queue_iter:
                    async for message in queue_iter:
                        logger.info(f' [x] Received message {message!r}')
                        try:
                            request = json.loads(message.body)
                        except json.JSONDecodeError as e:
                            logger.error(e, exc_info=True)
                            logger.error(f'File Annotation Failed: request contained malformed JSON body:')
                            logger.error(message.body)
                            return

                        try:
                            if 'enrichment_mapping' in request:
                                result = _handle_text_annotation(request)
                            else:
                                result = _handle_file_annotation(request)
                            logger.debug(result)
                        except KeyError:
                            logger.error(f'File Annotation Failed: request contained invalid JSON body:')
                            logger.error(message.body)
                            return
                        await publish(body=result, queue=POST_ANNOTATOR_QUEUE)
                        await message.ack()
                await asyncio.sleep(0.1)

    async def publish(body: dict, queue: str) -> None:
        async with channel_pool.acquire() as channel:
            message = Message(
                body=json.dumps(body).encode('utf-8'),
                delivery_mode=DeliveryMode.PERSISTENT,
            )

            await channel.default_exchange.publish(
                message,
                queue
            )
            logger.info(f' [x] Sent {message!r}')
    task = loop.create_task(consume())
    await task

if __name__ == '__main__':
    loop = asyncio.get_event_loop()
    loop.run_until_complete(main())
    loop.close()