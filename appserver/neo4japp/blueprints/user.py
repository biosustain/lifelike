from datetime import datetime

from flask import Blueprint, g, jsonify
from flask.views import MethodView
from marshmallow import ValidationError
from sqlalchemy import and_
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import login_optional
from neo4japp.database import db
from neo4japp.models import Projects, Files
from neo4japp.schemas.filesystem import (
    PublishSchema,
    MultipleFileResponseSchema,
    FileListSchema,
)
from neo4japp.services.filesystem import Filesystem
from neo4japp.services.publish import Publish
from neo4japp.utils import find
from neo4japp.utils.globals import get_current_user

bp = Blueprint('user', __name__, url_prefix='/user')


class PublishedView(MethodView):
    @login_optional
    def get(self, user_hash_id: str):
        project_***ARANGO_USERNAME***_id = (
            db.session.query(Projects.***ARANGO_USERNAME***_id)
            .filter(Projects.name == Publish.get_publish_project_name(user_hash_id))
            .first()
        )
        if project_***ARANGO_USERNAME***_id is not None:
            published_files = Filesystem.get_nondeleted_recycled_files(
                Files.parent_id == project_***ARANGO_USERNAME***_id
            )
        else:
            published_files = []

        return jsonify(
            FileListSchema(
                context={'user_privilege_filter': get_current_user('id')},
            ).dump(
                {
                    'total': len(published_files),
                    'results': published_files,
                }
            )
        )

    @use_args(PublishSchema, locations=['json', 'form', 'files', 'mixed_form_json'])
    def post(self, params: dict, user_hash_id: str):
        file = Publish.create_uncommited_publication(
            user_hash_id, creator=g.current_user, **params
        )

        db.session.commit()

        return Filesystem.get_file_response(file.hash_id, user=g.current_user)

    def delete(self, user_hash_id: str, publication_hash_id: str):
        """File delete endpoint."""

        current_user = g.current_user

        files = Filesystem.get_nondeleted_recycled_descendants(
            and_(
                Files.hash_id == publication_hash_id,
                Projects.name == self.get_publish_project_name(user_hash_id),
                Projects.***ARANGO_USERNAME***_id == Files.parent_id,
            )
        )
        publication = find(lambda f: f.project.***ARANGO_USERNAME*** == f.parent, files)
        # We only check the permissions on the publication itself, not the files within it
        # because the publication is the only thing that can be deleted and all the files
        # within it will be deleted as well
        Filesystem.check_file_permissions(
            publication, current_user, ['writable'], permit_recycled=True
        )

        # ========================================
        # Apply
        # ========================================
        for file in files:
            if file.calculated_project is None:
                raise ValidationError(
                    f"The file '{file.name}' is not in a project "
                    f"and cannot be deleted."
                )
            else:
                if file.calculated_project.***ARANGO_USERNAME***_id == file.id:
                    raise ValidationError(
                        f"You cannot delete the ***ARANGO_USERNAME*** directory "
                        f"for a project (the folder for the project "
                        f"'{file.calculated_project.name}' was specified)."
                    )

            if not file.recycled:
                file.recycling_date = datetime.now()
                file.recycler = current_user
                file.modifier = current_user

            file.delete()

        db.session.commit()
        # rollback in case of error?

        # ========================================
        # Return changed files
        # ========================================

        return jsonify(
            MultipleFileResponseSchema().dump(
                dict(
                    mapping={file.hash_id: file for file in files},
                    missing=[],
                )
            )
        )


bp.add_url_rule(
    '/<string:user_hash_id>/published',
    view_func=PublishedView.as_view('publish_read_write'),
    methods=['GET', 'POST'],
)
bp.add_url_rule(
    '/<string:user_hash_id>/published/<publication_hash_id>',
    view_func=PublishedView.as_view('publish_delete'),
    methods=['DELETE'],
)
