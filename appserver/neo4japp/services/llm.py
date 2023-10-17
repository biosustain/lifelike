import json
from http import HTTPStatus
from typing import cast

import requests
from flask import current_app, Response, g

from neo4japp.exceptions import ServerException
from neo4japp.utils.globals import config
from neo4japp.utils.transaction_id import transaction_id


class LLM:
    @classmethod
    def request(cls, path, **request_args) -> Response:
        host = config.get('LLM_HOST')
        port = config.get('LLM_PORT')
        host_port = f'{host}:{port}'
        url = f'http://{host_port}{path}'
        try:
            request_args['url'] = url
            resp = requests.request(**request_args)
            excluded_headers = [
                'content-encoding',
                'content-length',
                'transfer-encoding',
                'connection',
            ]
            headers = [
                (name, value)
                for (name, value) in resp.raw.headers.items()
                if name.lower() not in excluded_headers
            ]
        except Exception as e:
            raise ServerException(
                'An unexpected error occurred while connecting to service.',
                fields={
                    arg: request_args[arg]
                    for arg in request_args
                    if arg not in ['headers', 'cookies']
                },
            ) from e

        # 500 should contain message from service so we try to include it
        if resp.status_code == HTTPStatus.INTERNAL_SERVER_ERROR:
            try:
                decoded_error_message = json.loads(resp.content)['message']
            except Exception as e:
                # log and proceed so general error can be raised
                current_app.logger.error(
                    f'Could not process 500 error response from forwarded request.',
                    exc_info=e,
                )
            else:
                raise ServerException(
                    'Service error',
                    decoded_error_message,
                    code=cast(HTTPStatus, resp.status_code),
                )

        # All errors including failure to parse internal error message
        if 400 <= resp.status_code < 600:
            raise ServerException(
                'Unable to process request',
                'An internal error of service occurred.',
                code=cast(HTTPStatus, resp.status_code),
            )

        return Response(resp.content, resp.status_code, headers)

    @classmethod
    def graph_qa(cls, query, user, **data):
        return cls.request(
            '/graph',
            data=json.dumps(
                {
                    'query': query,
                    'transaction_id': getattr(g, 'transaction_id'),
                    'user': user,
                    'graph': {
                        'database_type': 'neo4j',
                    },
                }
            ),
            method='POST',
            headers={'Content-Type': 'application/json'},
        )
