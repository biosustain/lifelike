from flask import Blueprint, g, jsonify
from flask.views import MethodView
from sqlalchemy.exc import SQLAlchemyError
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.database import db
from neo4japp.models.reports import CopyrightInfringementRequest
from neo4japp.schemas.reports import CopyrightInfringementRequestSchema

bp = Blueprint('reports', __name__, url_prefix='/reports')

class CopyrightInfringementReportView(MethodView):
    decorators = [auth.login_required]

    @use_args(CopyrightInfringementRequestSchema)
    def post(self, params: dict):
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
            signature=params['signature']
        )

        try:
            db.session.add(copyright_infringement_report)
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            raise
        return jsonify(dict(result=copyright_infringement_report.to_dict()))


copyright_infringement_report_view = CopyrightInfringementReportView.as_view('accounts_api')
bp.add_url_rule('/copyright-infringement-report', view_func=copyright_infringement_report_view, methods=['POST'])
