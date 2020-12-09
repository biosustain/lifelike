import itertools
from datetime import datetime, timedelta
from operator import and_
from typing import Dict, Iterable, Union, List, Literal

from deepdiff import DeepDiff
from flask import Blueprint, jsonify, g, make_response
from flask.views import MethodView
from sqlalchemy import desc, or_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import aliased, contains_eager
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.drawing_tool import get_map
from neo4japp.blueprints.files import get_file
from neo4japp.blueprints.permissions import check_project_permission
from neo4japp.database import db
from neo4japp.exceptions import RecordNotFoundException
from neo4japp.models import AccessActionType, AppUser, Directory, Projects, Project
from neo4japp.models.files import FileLock, FileAnnotationsVersion, Files
from neo4japp.schemas.annotations import FileAnnotationHistoryResponseSchema
from neo4japp.schemas.common import PaginatedRequestSchema
from neo4japp.schemas.files import FileLockListResponse, FileLockCreateRequest,\
    FileLockDeleteRequest
from neo4japp.utils.collections import window

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


class FileAnnotationHistoryView(MethodView):
    """Implements lookup of a file's annotation history."""
    decorators = [auth.login_required]

    @use_args(PaginatedRequestSchema)
    def get(self, pagination: Dict, hash_id: str):
        """Get the annotation of a file."""
        user = g.current_user

        file = get_file(hash_id, user, AccessActionType.READ)

        query = db.session.query(FileAnnotationsVersion) \
            .filter(FileAnnotationsVersion.file == file) \
            .order_by(desc(FileAnnotationsVersion.creation_date))

        per_page = pagination['limit']
        page = pagination['page']

        total = query.order_by(None).count()
        items = itertools.chain(*([iter([file])] if page == 1 else []),
                                query.limit(per_page).offset((page - 1) * per_page))
        results = []

        for newer, older in window(items):
            results.append({
                'date': older.creation_date,
                'cause': older.cause,
                'inclusion_changes': self._get_annotation_changes(
                    older.custom_annotations, newer.custom_annotations, 'inclusion'),
                'exclusion_changes': self._get_annotation_changes(
                    older.excluded_annotations, newer.excluded_annotations, 'exclusion'),
            })

        return jsonify(FileAnnotationHistoryResponseSchema().dump({
            'total': total,
            'results': results,
        }))

    def _get_annotation_changes(self,
                                older: List[Union[FileAnnotationsVersion, Files]],
                                newer: List[Union[FileAnnotationsVersion, Files]],
                                type: Union[Literal['inclusion'], Literal['exclusion']]
                                ) -> Iterable[Dict]:
        changes: Dict[str, Dict] = {}

        if older is None and newer is not None:
            for annotation in newer:
                self._add_change(changes, 'added', annotation, type)
        elif older is not None and newer is None:
            for annotation in older:
                self._add_change(changes, 'removed', annotation, type)
        elif older is not None and newer is not None:
            ddiff = DeepDiff(older, newer, ignore_order=True)
            for action in ('added', 'removed'):
                for key, annotation in ddiff.get(f'iterable_item_{action}', {}).items():
                    if key.startswith('root['):  # Only care about root changes right now
                        self._add_change(changes, action, annotation, type)

        return changes.values()

    def _add_change(self, changes: Dict[str, Dict], action: str, annotation: Dict,
                    type: Union[Literal['inclusion'], Literal['exclusion']]) -> None:
        meta = annotation['meta'] if type == 'inclusion' else annotation
        id = meta['id'] if len(meta['id']) else f"@@{meta['allText']}"

        if id not in changes:
            changes[id] = {
                'action': action,
                'meta': meta,
                'instances': [],
            }

        changes[id]['instances'].append(annotation)


bp.add_url_rule('/objects/<string:hash_id>/locks',
                view_func=FileLockListView.as_view('file_lock_list'))
bp.add_url_rule('/objects/<string:hash_id>/annotation-history',
                view_func=FileAnnotationHistoryView.as_view('file_annotation_history'))
