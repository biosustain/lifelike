import json
import logging
import os

import requests
from flask import Blueprint, Response, request
from requests.exceptions import ConnectionError

from neo4japp.blueprints.auth import auth
from neo4japp.exceptions import StatisticalEnrichmentError

SE_URL = os.getenv("STATISTICAL_ENRICHMENT_URL", "http://statistical-enrichment:5000")

bp = Blueprint(
    "enrichment-visualisation-api", __name__, url_prefix="/enrichment-visualisation"
)


@bp.route("/enrich-with-go-terms", methods=["POST"])
@auth.login_required
def enrich_go():
    return _proxy_se_request("/enrich-with-go-terms")


def _proxy_se_request(resource):
    try:
        resp = requests.request(
            url=f"{SE_URL}{resource}",
            method=request.method,
            headers={key: value for (key, value) in request.headers if key != "Host"},
            data=request.get_data(),
            allow_redirects=False,
            timeout=60,
        )
    except ConnectionError as e:
        raise StatisticalEnrichmentError(
            "Unable to process request",
            "An unexpected connection error occurred to statistical enrichment service.",
            code=503,
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
                code=500,
            )

    # All errors including failure to parse internal error message
    if 400 <= resp.status_code < 600:
        raise StatisticalEnrichmentError(
            "Unable to process request",
            "An error of statistical enrichment service occurred.",
            code=resp.status_code,
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

    return Response(resp.content, resp.status_code, headers)
