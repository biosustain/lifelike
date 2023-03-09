import json
import logging
import os

import requests
from flask import Blueprint, request, Response
from requests.exceptions import ConnectionError

from neo4japp.exceptions import StatisticalEnrichmentError

bp = Blueprint(
    "enrichment-visualisation-api", __name__, url_prefix="/enrichment-visualisation"
)

host = os.getenv("SE_HOST", "statistical-enrichment")
port = os.getenv("SE_PORT", "5010")


def forward_request():
    host_port = f"{host}:{port}"
    url = f"{request.scheme}://{request.path.replace(bp.url_prefix, host_port)}"
    try:
        resp = requests.request(
            method=request.method,
            url=url,
            headers={key: value for (key, value) in request.headers if key != "Host"},
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False,
        )
        excluded_headers = [
            "content-encoding",
            "content-length",
            "transfer-encoding",
            "connection",
        ]
        headers = [
            (name, value)
            for (name, value) in resp.raw.headers.items()
            if name.lower() not in excluded_headers
        ]
    except ConnectionError as e:
        raise StatisticalEnrichmentError(
            "Unable to process request",
            "An unexpected connection error occurred to statistical enrichment service.",
        )

    # 500 should contain message from service so we try to include it
    if resp.status_code == 500:
        try:
            decoded_error_message = json.loads(resp.content)["message"]
        except Exception as e:
            # log and proceed so general error can be raised
            logging.exception(e)
        else:
            raise StatisticalEnrichmentError(
                "Statistical enrichment error",
                decoded_error_message,
                code=resp.status_code,
            )

    # All errors including failure to parse internal error message
    if 400 <= resp.status_code < 600:
        raise StatisticalEnrichmentError(
            "Unable to process request",
            "An internal error of statistical enrichment service occurred.",
            code=resp.status_code,
        )

    return Response(resp.content, resp.status_code, headers)


@bp.route("/enrich-with-go-terms", methods=["POST"])
def enrich_go():
    return forward_request()
