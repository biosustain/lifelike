import os

from flask import Blueprint, current_app, g, make_response

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_role
from neo4japp.database import db, get_excel_export_service
from neo4japp.exceptions import DatabaseError
from neo4japp.models import (
    AppUser,
    FileContent,
    Files,
    GlobalList,
    InclusionExclusionType,
    Projects
)

bp = Blueprint('annotations', __name__, url_prefix='/annotations')


@bp.route('/global_list/inclusions')
@auth.login_required
@requires_role('admin')
def export_global_inclusions():
    yield g.current_user

    inclusions = GlobalList.query.filter_by(
        type=InclusionExclusionType.INCLUSION.value,
        reviewed=False
    ).all()

    def get_inclusion_for_review(inclusion):
        user = AppUser.query.filter_by(id=inclusion.annotation['user_id']).one_or_none()
        username = f'{user.first_name} {user.last_name}' if user is not None else 'not found'
        hyperlink = 'not found'

        if inclusion.file_id is not None:
            domain = os.environ.get('DOMAIN')
            hyperlink = f'{domain}:5000/files/download/{inclusion.file_id}'

        missing_data = any([
            inclusion.annotation['meta'].get('id', None) is None,
            inclusion.annotation['meta'].get('primaryLink', None) is None
        ])

        if missing_data:
            current_app.logger.warning(
                f'Found exclusion in the global list with missing data: \n' +
                f'\tID: {inclusion.annotation["meta"].get("id", "")}\n' +
                f'\tPrimary Link: {inclusion.annotation["meta"].get("primaryLink", "")}\n'
            )

        return {
            'id': inclusion.annotation['meta'].get('id', ''),
            'term': inclusion.annotation['meta']['allText'],
            'type': inclusion.annotation['meta']['type'],
            'primary_link': inclusion.annotation['meta'].get('primaryLink', ''),
            'inclusion_date': inclusion.annotation.get('inclusion_date', ''),
            'user': username,
            'hyperlink': hyperlink
        }

    data = [get_inclusion_for_review(inclusion) for inclusion in inclusions]

    exporter = get_excel_export_service()
    response = make_response(exporter.get_bytes(data), 200)
    response.headers['Content-Type'] = exporter.mimetype
    response.headers['Content-Disposition'] = \
        f'attachment; filename={exporter.get_filename("global_inclusions")}'
    yield response


@bp.route('/global_list/exclusions')
@auth.login_required
@requires_role('admin')
def export_global_exclusions():
    yield g.current_user

    exclusions = GlobalList.query.filter_by(
        type=InclusionExclusionType.EXCLUSION.value,
        reviewed=False,
    ).all()

    def get_exclusion_for_review(exclusion):
        user = AppUser.query.filter_by(id=exclusion.annotation['user_id']).one_or_none()
        username = f'{user.first_name} {user.last_name}' if user is not None else 'not found'
        hyperlink = 'not found'

        if exclusion.file_id is not None:
            domain = os.environ.get('DOMAIN')
            hyperlink = f'{domain}:5000/files/download/{exclusion.file_id}'

        missing_data = any([
            exclusion.annotation.get('text', None) is None,
            exclusion.annotation.get('type', None) is None,
            exclusion.annotation.get('idHyperlink', None) is None
        ])

        if missing_data:
            current_app.logger.warning(
                f'Found exclusion in the global list with missing data: \n' +
                f'\tTerm: {exclusion.annotation.get("text", "")}\n' +
                f'\tType: {exclusion.annotation.get("type", "")}\n' +
                f'\tExclusion Date: {exclusion.annotation.get("exclusion_date", "")}\n'
            )

        return {
            'term': exclusion.annotation.get('text', ''),
            'type': exclusion.annotation.get('type', ''),
            'id_hyperlink': exclusion.annotation.get('idHyperlink', ''),
            'reason': exclusion.annotation['reason'],
            'comment': exclusion.annotation['comment'],
            'exclusion_date': exclusion.annotation['exclusion_date'],
            'user': username,
            'hyperlink': hyperlink
        }

    data = [get_exclusion_for_review(exclusion) for exclusion in exclusions]

    exporter = get_excel_export_service()
    response = make_response(exporter.get_bytes(data), 200)
    response.headers['Content-Type'] = exporter.mimetype
    response.headers['Content-Disposition'] = \
        f'attachment; filename={exporter.get_filename("global_exclusions")}'
    yield response
