import requests
from flask import (
    Blueprint, request, Response
)
from neo4japp.blueprints.auth import auth

bp = Blueprint('enrichment-visualisation-api', __name__, url_prefix='/enrichment-visualisation')

def forward_request():
    url = f'{request.scheme}://{request.path.replace(bp.url_prefix, "statistical-enrichment")}'
    resp = requests.request(
        method=request.method,
        url=url,
        headers={key: value for (key, value) in request.headers if key != 'Host'},
        data=request.get_data(),
        cookies=request.cookies,
        allow_redirects=False
    )

    excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
    headers = [(name, value) for (name, value) in resp.raw.headers.items()
               if name.lower() not in excluded_headers]

    return Response(resp.content, resp.status_code, headers)

@bp.route('/enrich-with-go-terms', methods=['POST'])
@auth.login_required
def enrich_go():
    return forward_request()
