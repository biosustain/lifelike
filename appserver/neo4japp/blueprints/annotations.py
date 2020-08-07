import os

from flask import Blueprint, g, make_response

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_role
from neo4japp.database import db, get_excel_export_service
from neo4japp.models import AppUser, Files, GlobalList, Projects

bp = Blueprint('annotations', __name__, url_prefix='/annotations')


@bp.route('/global_list/inclusions')
@auth.login_required
@requires_role('admin')
def export_global_inclusions():
    yield g.current_user

    inclusions = GlobalList.query.filter_by(type='inclusion', reviewed=False).all()

    def get_inclusion_for_review(inclusion):
        user = AppUser.query.filter_by(id=inclusion.annotation['user_id']).one_or_none()
        username = f'{user.first_name} {user.last_name}' if user is not None else 'not found'
        hyperlink = 'not found'
        file = Files.query.filter_by(id=inclusion.file_id).one_or_none()
        if file is not None:
            domain = os.environ.get('DOMAIN')
            project = Projects.query.filter_by(id=file.project).one_or_none()
            hyperlink = f'{domain}/projects/{project.project_name}/files/{file.file_id}' \
                if project is not None else 'not found'

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

    exclusions = GlobalList.query.filter_by(type='exclusion', reviewed=False).all()

    def get_exclusion_for_review(exclusion):
        user = AppUser.query.filter_by(id=exclusion.annotation['user_id']).one_or_none()
        username = f'{user.first_name} {user.last_name}' if user is not None else 'not found'
        hyperlink = 'not found'
        file = Files.query.filter_by(id=exclusion.file_id).one_or_none()
        if file is not None:
            domain = os.environ.get('DOMAIN')
            project = Projects.query.filter_by(id=file.project).one_or_none()
            hyperlink = f'{domain}/projects/{project.project_name}/files/{file.file_id}' \
                if project is not None else 'not found'

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
