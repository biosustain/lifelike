from flask import Blueprint, jsonify, g, make_response, request
from flask.views import MethodView
from sqlalchemy import and_
from sqlalchemy.orm import raiseload, joinedload

from neo4japp.blueprints.auth import auth
from neo4japp.database import db
from neo4japp.exceptions import RecordNotFoundException, AccessRequestRequiredError
from neo4japp.models import Projects, AppUser, Files
from neo4japp.models.files_queries import get_file_parent_hierarchy, add_user_permission_columns, FileHierarchy, \
    get_projects_from_hierarchy
from neo4japp.utils.views import StatefulViewMixin

bp = Blueprint('filesystem', __name__, url_prefix='/filesystem')


class FileObjectMixin:
    def get_file(self, hash_id, load_content=False):
        current_user = g.current_user

        t_file = db.aliased(Files, name='_file')  # alias required for the FileHierarchy class
        t_project = db.aliased(Projects, name='_project')

        # Goals:
        # - Remove deleted files (done in recursive CTE)
        # - Remove deleted projects (done in main query)
        # - Allow recycled files (done in main query)
        # - Fetch permissions (done in main query)
        # Do it in one query efficiently

        # Fetch the target file and its parents
        q_hierarchy = get_file_parent_hierarchy(and_(
            Files.hash_id == hash_id,
            Files.deletion_date.is_(None),
        ))

        # Only the top-most directory has a project FK, so we need to reorganize
        # the query results from the CTE so we have a project ID for every file row
        q_hierarchy_project = get_projects_from_hierarchy(q_hierarchy)

        # Main query
        query = db.session.query(t_file,
                                 q_hierarchy.c.initial_id,
                                 q_hierarchy.c.level,
                                 t_project) \
            .join(q_hierarchy, q_hierarchy.c.id == t_file.id) \
            .join(q_hierarchy_project, q_hierarchy_project.c.initial_id == q_hierarchy.c.initial_id) \
            .join(t_project, t_project.***ARANGO_USERNAME***_id == q_hierarchy_project.c.project_id) \
            .filter(t_project.deletion_date.is_(None)) \
            .options(raiseload('*'),
                     joinedload(t_file.user)) \
            .order_by(q_hierarchy.c.level)

        # Fetch permissions for the given user
        query = add_user_permission_columns(query, t_project, t_file, current_user.id)

        if load_content:
            # Note: If we ever implement file sub-streams, this would also join those
            # content rows
            query = query.options(joinedload(t_file.content))

        results = query.all()

        if not results:
            raise RecordNotFoundException('Requested object does not exist')

        hierarchy = FileHierarchy(results, t_file, t_project)

        if not hierarchy.may_read(g.current_user.id):
            raise AccessRequestRequiredError("You may have to request access to this object")

        return hierarchy

    def _hierarchy_to_dict(self, object):
        project = object.project
        file = object.file
        current_user = g.current_user

        return {
            'project': project.to_dict(only=Projects.API_FIELDS),
            'object': {
                **file.to_dict(only=Files.API_FIELDS),
                'user': file.user.to_dict(only=AppUser.API_FIELDS),
                'privileges': {
                    'read': self.object.may_read(current_user.id),
                    'write': self.object.may_write(current_user.id),
                    'comment': self.object.may_comment(current_user.id),
                }
            },
            'parents': [parent.to_dict(only=Files.API_FIELDS) for parent in self.object.parents]
        }


class FileDetailView(FileObjectMixin, StatefulViewMixin, MethodView):
    decorators = [auth.login_required]

    def get_object(self, load_content=False):
        return self.get_file(self.kwargs['hash_id'])

    def get(self):
        self.object = self.get_object()
        return jsonify(self._hierarchy_to_dict(self.object))


class FileContentView(FileObjectMixin, StatefulViewMixin, MethodView):
    decorators = [auth.login_required]

    def get(self):
        self.object = self.get_object(load_content=True)

        file = self.object.file
        content = self.object.file.content

        if content:
            etag = content.checksum_sha256.hex()

            # Handle ETag cache response
            if request.if_none_match and etag in request.if_none_match:
                return '', 304
            else:
                response = make_response(content.raw_file)
                response.headers['Cache-Control'] = 'no-cache, max-age=0'
                response.headers['Content-Type'] = file.mime_type
                response.headers['Content-Length'] = len(content.raw_file)
                response.headers['Content-Disposition'] = f"attachment;filename={file.filename}"
                response.headers['ETag'] = f'"{etag}"'
                return response
        else:
            raise RecordNotFoundException('Requested object has no content')


bp.add_url_rule('objects/<string:hash_id>', view_func=FileDetailView.as_view('file_detail'))
bp.add_url_rule('objects/<string:hash_id>/content', view_func=FileContentView.as_view('file_content'))
