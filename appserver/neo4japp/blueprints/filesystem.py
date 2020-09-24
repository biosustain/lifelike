from flask import Blueprint, jsonify, g, make_response
from flask.views import MethodView
from sqlalchemy import and_
from sqlalchemy.orm import contains_eager, raiseload, joinedload

from neo4japp.blueprints.auth import auth
from neo4japp.database import db
from neo4japp.exceptions import RecordNotFoundException, AccessRequestRequiredError
from neo4japp.models import Projects, AppUser, Files
from neo4japp.models.files_queries import get_file_parent_hierarchy, add_user_permission_columns, FileHierarchy
from neo4japp.utils.views import StatefulViewMixin

bp = Blueprint('filesystem', __name__, url_prefix='/filesystem')


class FileObjectMixin:
    def get_object(self, load_content=False):
        current_user = g.current_user

        t_file = db.aliased(Files, name='_file')
        t_project = db.aliased(Projects)

        q_hierarchy = get_file_parent_hierarchy(and_(
            Files.hash_id == self.kwargs['hash_id'],
            Files.deletion_date.is_(None),
            Projects.deletion_date.is_(None),
        ))

        query = db.session.query(t_file,
                                 q_hierarchy.c.level) \
            .join(q_hierarchy, q_hierarchy.c.id == t_file.id) \
            .join(t_project, t_project.id == t_file.project_id) \
            .options(raiseload('*'),
                     joinedload(t_file.user),
                     contains_eager(t_file.project, alias=t_project)) \
            .order_by(q_hierarchy.c.level)

        if load_content:
            query = query.options(joinedload(t_file.content))

        query = add_user_permission_columns(query, t_project, t_file, current_user.id)

        results = query.all()

        if not results:
            raise RecordNotFoundException('Requested object does not exist')

        object = FileHierarchy(results, t_file)

        if not object.may_read(g.current_user.id):
            raise AccessRequestRequiredError("You may have to request access to this object")

        return object


class FileView(FileObjectMixin, StatefulViewMixin, MethodView):
    decorators = [auth.login_required]

    def get(self):
        self.object = self.get_object()
        return jsonify(self._hierarchy_to_dict(self.object))

    def _hierarchy_to_dict(self, object):
        file = object.file
        current_user = g.current_user

        return {
            'object': {
                **file.to_dict(only=Files.API_FIELDS),
                'user': file.user.to_dict(only=AppUser.API_FIELDS),
                'project': file.project.to_dict(only=Projects.API_FIELDS),
                'privileges': {
                    'read': self.object.may_read(current_user.id),
                    'write': self.object.may_write(current_user.id),
                    'comment': self.object.may_comment(current_user.id),
                }
            },
            'parents': [parent.to_dict(only=Files.API_FIELDS) for parent in self.object.parents]
        }


class FileContentView(FileObjectMixin, StatefulViewMixin, MethodView):
    decorators = [auth.login_required]

    def get(self):
        self.object = self.get_object(load_content=True)
        file = self.object.file
        content = self.object.file.content
        if content:
            response = make_response(content.raw_file)
            response.headers['Content-Type'] = file.mime_type
            response.headers['Content-Length'] = len(content.raw_file)
            response.headers['Content-Disposition'] = f"attachment;filename={file.filename}"
            response.headers['ETag'] = content.checksum_sha256
            return response
        else:
            raise RecordNotFoundException('Requested object has no content')


bp.add_url_rule('objects/<string:hash_id>', view_func=FileView.as_view('file'))
bp.add_url_rule('objects/<string:hash_id>/content', view_func=FileContentView.as_view('file_content'))
