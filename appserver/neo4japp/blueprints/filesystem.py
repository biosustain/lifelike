import itertools
from typing import Dict, Union, Literal, List, Iterable

from deepdiff import DeepDiff
from flask import Blueprint, jsonify, g
from flask.views import MethodView
from sqlalchemy import desc
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.files import get_file
from neo4japp.database import db
from neo4japp.models import AccessActionType
from neo4japp.models.files import FileAnnotationsVersion, Files
from neo4japp.schemas.annotations import FileAnnotationHistoryResponseSchema
from neo4japp.schemas.common import PaginatedRequestSchema
from neo4japp.utils.collections import window

bp = Blueprint('filesystem', __name__, url_prefix='/filesystem')


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


bp.add_url_rule('/objects/<string:hash_id>/annotation-history',
                view_func=FileAnnotationHistoryView.as_view('file_annotation_history'))
