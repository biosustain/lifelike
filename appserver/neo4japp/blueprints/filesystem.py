from datetime import datetime, timedelta
from operator import and_
from typing import Dict

from flask import Blueprint, jsonify, g, make_response
from flask.views import MethodView
from sqlalchemy import desc, or_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import aliased, contains_eager
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.drawing_tool import get_map
from neo4japp.blueprints.permissions import check_project_permission
from neo4japp.database import db
from neo4japp.exceptions import RecordNotFoundException
from neo4japp.models import AccessActionType, AppUser, Directory, Projects, Project
from neo4japp.models.files import FileLock
from neo4japp.schemas.files import FileLockListResponse, FileLockCreateRequest,\
    FileLockDeleteRequest

bp = Blueprint('filesystem', __name__, url_prefix='/filesystem')


class BaseFileLockView(MethodView):
    cutoff_duration = timedelta(minutes=5)

    def get_locks_response(self, hash_id: str):
        current_user = g.current_user

        t_map = aliased(Project)
        t_lock_user = aliased(AppUser)
        t_directory = aliased(Directory)
        t_project = aliased(Projects)

        cutoff_date = datetime.now() - self.cutoff_duration

        query = db.session.query(t_map, FileLock) \
            .outerjoin(FileLock, and_(FileLock.hash_id == t_map.hash_id,
                                      FileLock.acquire_date >= cutoff_date)) \
            .outerjoin(t_lock_user, t_lock_user.id == FileLock.user_id) \
            .join(t_directory, t_directory.id == t_map.dir_id) \
            .join(t_project, t_project.id == t_directory.projects_id) \
            .options(contains_eager(FileLock.user, alias=t_lock_user)) \
            .filter(t_map.hash_id == hash_id) \
            .order_by(desc(FileLock.acquire_date))

        results = query.all()

        if not len(results):
            raise RecordNotFoundException(f'File not found.')

        check_project_permission(results[0][0].dir.project, current_user, AccessActionType.WRITE)

        return jsonify(FileLockListResponse(context={
            'current_user': current_user,
        }).dump({
            'results': [result[1] for result in results if result[1] is not None],
        }))


class FileLockListView(BaseFileLockView):
    """Endpoint to get the locks for a file."""
    decorators = [auth.login_required]

    def get(self, hash_id: str):
        return self.get_locks_response(hash_id)

    @use_args(FileLockCreateRequest)
    def put(self, params: Dict, hash_id: str):
        current_user = g.current_user

        map = get_map(hash_id, current_user, AccessActionType.WRITE)

        acquire_date = datetime.now()
        cutoff_date = datetime.now() - self.cutoff_duration

        file_lock_table = FileLock.__table__
        stmt = insert(file_lock_table).returning(
            file_lock_table.c.user_id,
        ).values(hash_id=map.hash_id,
                 user_id=current_user.id,
                 acquire_date=acquire_date
                 ).on_conflict_do_update(
            index_elements=[
                file_lock_table.c.hash_id,
            ],
            set_={
                'acquire_date': datetime.now(),
                'user_id': current_user.id,
            },
            where=and_(
                file_lock_table.c.hash_id == hash_id,
                or_(file_lock_table.c.user_id == current_user.id,
                    file_lock_table.c.acquire_date < cutoff_date)
            ),
        )

        result = db.session.execute(stmt)
        lock_acquired = bool(len(list(result)))
        db.session.commit()

        if lock_acquired:
            return self.get_locks_response(hash_id)
        else:
            return make_response(self.get_locks_response(hash_id), 409)

    @use_args(FileLockDeleteRequest)
    def delete(self, params: Dict, hash_id: str):
        current_user = g.current_user

        map = get_map(hash_id, current_user, AccessActionType.WRITE)

        file_lock_table = FileLock.__table__
        db.session.execute(
            file_lock_table.delete().where(and_(
                file_lock_table.c.hash_id == map.hash_id,
                file_lock_table.c.user_id == current_user.id))
        )
        db.session.commit()

        return self.get_locks_response(hash_id)


bp.add_url_rule('/objects/<string:hash_id>/locks',
                view_func=FileLockListView.as_view('file_lock_list'))
