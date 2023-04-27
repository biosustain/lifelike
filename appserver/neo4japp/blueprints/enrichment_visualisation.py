import json
from http import HTTPStatus
import requests
from flask import Blueprint, Response, current_app, request

from neo4japp.utils.globals import config
from neo4japp.exceptions import StatisticalEnrichmentError, wrap_exceptions
from neo4japp.services.chat_gpt import ChatGPT

bp = Blueprint(
    'enrichment-visualisation-api', __name__, url_prefix='/enrichment-visualisation'
)


def forward_request():
    host = config.get('SE_HOST')
    port = config.get('SE_PORT')
    host_port = f'{host}:{port}'
    url = f'{request.scheme}://{request.path.replace(bp.url_prefix, host_port)}'
    try:
        request_args = {
            'method': request.method,
            'url': url,
            'headers': {
                key: value for (key, value) in request.headers if key != 'Host'
            },
            'data': request.get_data(),
            'cookies': request.cookies,
            'allow_redirects': False,
        }
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
        raise StatisticalEnrichmentError(
            'Statistical Enrichment Error',
            'An unexpected error occurred while connecting to statistical enrichment service.',
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
            raise StatisticalEnrichmentError(
                'Statistical enrichment error',
                decoded_error_message,
                code=resp.status_code,
            )

    # All errors including failure to parse internal error message
    if 400 <= resp.status_code < 600:
        raise StatisticalEnrichmentError(
            'Unable to process request',
            'An internal error of statistical enrichment service occurred.',
            code=resp.status_code,
        )

    return Response(resp.content, resp.status_code, headers)


@bp.route('/enrich-with-go-terms', methods=['POST'])
@wrap_exceptions(StatisticalEnrichmentError)
def enrich_go():
    return forward_request()


@bp.route('/enrich-with-context', methods=['POST'])
def enrich_context():
    data = request.get_json()
    organism = data.get('organism', '')
    term = data.get('term', '')
    response = ChatGPT.Completion.create(
      model="text-davinci-003",
      prompt=f'What is the ralationship between ${organism} and ${term}?',
      temperature=0,
      max_tokens=200
    )
    for choice in response.get('choices'):
        return {"result": choice.get('text').strip()}
