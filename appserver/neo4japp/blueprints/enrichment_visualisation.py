import json
import logging
import os
from http import HTTPStatus

import requests
from flask import Blueprint, Response, request
from neo4japp.exceptions import StatisticalEnrichmentError
from requests.exceptions import ConnectionError

bp = Blueprint('enrichment-visualisation-api', __name__, url_prefix='/enrichment-visualisation')

url = os.getenv('STATISTICAL_ENRICHMENT_URL', 'http://localhost:5010')


@bp.route('/enrich-with-go-terms', methods=['POST'])
def forward_request():
    try:
        resp = requests.request(
            url=url,
            method=request.method,
            headers={key: value for (key, value) in request.headers if key != 'Host'},
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False
        )
    except ConnectionError as e:
        raise StatisticalEnrichmentError(
            'Unable to process request',
            'An unexpected connection error occurred to statistical enrichment service.',
            code=HTTPStatus.BAD_GATEWAY
        )

    excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
    headers = [
        (name, value) for (name, value) in resp.raw.headers.items()
        if name.lower() not in excluded_headers
    ]

    # 500 should contain message from service so we try to include it
    if resp.status_code == 500:
        try:
            decoded_error_message = json.loads(resp.content)['message']
        except Exception as e:
            # log and proceed so general error can be raised
            logging.exception(e)
        else:
            raise StatisticalEnrichmentError(
                'Statistical enrichment error',
                decoded_error_message,
                code=HTTPStatus.BAD_GATEWAY
            )

    # All errors including failure to parse internal error message
    if 400 <= resp.status_code < 600:
        raise StatisticalEnrichmentError(
            'Unable to process request',
            'An internal error of statistical enrichment service occurred. ' +
            f'Upstream service status code was: {resp.status_code}',
            code=HTTPStatus.BAD_GATEWAY,
        )

    return Response(resp.content, resp.status_code, headers)
