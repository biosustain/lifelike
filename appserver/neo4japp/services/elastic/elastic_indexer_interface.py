import asyncio

from flask import current_app
from typing import Dict, List

from neo4japp.services.rabbitmq import send

BULK_INDEX_OP = 'BULK_INDEX'
BULK_UPDATE_OP = 'BULK_UPDATE'
BULK_DELETE_OP = 'BULK_DELETE'


def send_index_file_request(sources: Dict[str, dict]):
    _send_elastic_indexer_request({
        'op_type': BULK_INDEX_OP,
        'sources': sources
    })


def send_update_file_request(updates: Dict[str, dict]):
    _send_elastic_indexer_request({
        'op_type': BULK_UPDATE_OP,
        'updates': updates
    })


def send_delete_file_request(file_hash_ids: List[str]):
    _send_elastic_indexer_request({
        'op_type': BULK_DELETE_OP,
        'file_hash_ids': file_hash_ids
    })


def _send_elastic_indexer_request(body: dict):
    current_app.logger.debug(body)
    asyncio.run(
        send(
            body=body,
            queue=current_app.config.get('ELASTIC_INDEXER_QUEUE')
        )
    )
