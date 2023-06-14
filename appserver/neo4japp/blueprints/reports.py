from flask import Blueprint, jsonify
from flask.views import MethodView
from sendgrid.helpers.mail import Mail
from webargs.flaskparser import use_args

from neo4japp.constants import (
    COPYRIGHT_REPORT_CONFIRMATION_EMAIL_CONTENT,
    COPYRIGHT_REPORT_CONFIRMATION_EMAIL_TITLE,
    LIFELIKE_EMAIL_ACCOUNT,
    MESSAGE_SENDER_IDENTITY,
)
from neo4japp.database import db
from neo4japp.models.reports import CopyrightInfringementRequest
from neo4japp.schemas.reports import CopyrightInfringementRequestSchema
from neo4japp.services.send_grid import get_send_grid_service

bp = Blueprint('reports', __name__, url_prefix='/reports')


class CopyrightInfringementReportView(MethodView):
    @use_args(CopyrightInfringementRequestSchema)
    def post(self, params: dict):
        with db.session.begin_nested():
            copyright_infringement_report = CopyrightInfringementRequest(
                url=params['url'],
                description=params['description'],
                name=params['name'],
                company=params['company'],
                address=params['address'],
                country=params['country'],
                city=params['city'],
                province=params['province'],
                zip=params['zip'],
                phone=params['phone'],
                fax=params['fax'],
                email=params['email'],
                attestationCheck1=params['attestationCheck1'],
                attestationCheck2=params['attestationCheck2'],
                attestationCheck3=params['attestationCheck3'],
                attestationCheck4=params['attestationCheck4'],
                signature=params['signature'],
            )
            db.session.add(copyright_infringement_report)

            message = Mail(
                from_email=MESSAGE_SENDER_IDENTITY,
                to_emails=params['email'],
                subject=COPYRIGHT_REPORT_CONFIRMATION_EMAIL_TITLE,
                html_content=COPYRIGHT_REPORT_CONFIRMATION_EMAIL_CONTENT.format(
                    url=params['url'],
                    description=params['description'],
                    name=params['name'],
                    company=params['company'],
                    address=params['address'],
                    country=params['country'],
                    city=params['city'],
                    province=params['province'],
                    zip=params['zip'],
                    phone=params['phone'],
                    fax=params['fax'],
                    email=params['email'],
                ),
            )
            message.add_bcc(bcc_email=LIFELIKE_EMAIL_ACCOUNT)
            get_send_grid_service().send(message)
            # If for some reason we cannot send a confirmation email, the row we just
            # created will be rolled back.

        return jsonify(dict(result=copyright_infringement_report.to_dict()))


copyright_infringement_report_view = CopyrightInfringementReportView.as_view(
    'accounts_api'
)
bp.add_url_rule(
    '/copyright-infringement-report',
    view_func=copyright_infringement_report_view,
    methods=['POST'],
)
