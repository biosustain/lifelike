import json
import logging
import os

import requests
from flask import (
    Blueprint, request, Response
)

from neo4japp.blueprints.auth import auth
from neo4japp.exceptions import StatisticalEnrichmentError

bp = Blueprint('enrichment-visualisation-api', __name__, url_prefix='/enrichment-visualisation')

host = os.getenv('SE_HOST', 'statistical-enrichment')
port = os.getenv('SE_PORT', '5010')


def forward_request():
    host_port = f'{host}:{port}'
    url = f'{request.scheme}://{request.path.replace(bp.url_prefix, host_port)}'
    try:
        resp = requests.request(
                method=request.method,
                url=url,
                headers={key: value for (key, value) in request.headers if key != 'Host'},
                data=request.get_data(),
                cookies=request.cookies,
                allow_redirects=False
        )
    except ConnectionError:
        raise StatisticalEnrichmentError()

    excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
    headers = [(name, value) for (name, value) in resp.raw.headers.items()
        if name.lower() not in excluded_headers]

    # 500 should be enough verbose so it is passed through with prefix
    if resp.status_code == 500:
        try:
            decoded_error_message = json.loads(resp.content)['message']
            return Response("Statistical enrichment error:" + decoded_error_message,
                        resp.status_code,
                        headers)
        except Exception as e:
            logging.exception(e)
    if resp.status_code >= 400:
        return Response("Internal error of statistical enrichment service.", resp.status_code,
                        headers)

    return Response(resp.content, resp.status_code, headers)


@bp.route('/enrich-with-go-terms', methods=['POST'])
@auth.login_required
def enrich_go():
    return forward_request()
