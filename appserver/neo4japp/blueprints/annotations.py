import sqlalchemy as sa
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Tuple

from flask import (
    Blueprint,
    current_app,
    g,
    make_response,
    request,
    jsonify,
)

from flask_apispec import use_kwargs

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import (
    requires_role,
    requires_project_permission
)
from neo4japp.constants import TIMEZONE
from neo4japp.database import (
    db,
    get_excel_export_service,
    get_manual_annotation_service,
)
from neo4japp.data_transfer_objects.common import ResultList
from neo4japp.models.files import FileAnnotationsVersion, AnnotationChangeCause
from neo4japp.request_schemas.annotations import GlobalAnnotationsDeleteSchema
from neo4japp.exceptions import (
    AnnotationError,
    RecordNotFoundException
)
from neo4japp.models import (
    AccessActionType,
    AppUser,
    Files,
    FileContent,
    GlobalList,
    Projects,
    FallbackOrganism
)
import neo4japp.models.files_queries as files_queries
from neo4japp.services.annotations.constants import (
    AnnotationMethod,
    EntityType,
    ManualAnnotationType,
)
from neo4japp.services.annotations.data_transfer_objects import (
    AnnotationRequest,
    GlobalAnnotationData
)
from neo4japp.services.annotations.pipeline import create_annotations
from neo4japp.util import (
    jsonify_with_class,
    SuccessResponse,
)
from neo4japp.utils.logger import UserEventLog

from neo4japp.services.annotations import AnnotationGraphService


bp = Blueprint('annotations', __name__, url_prefix='/annotations')


def annotate(
    doc: Files,
    cause: AnnotationChangeCause,
    specified_organism: Optional[FallbackOrganism] = None,
    annotation_method: str = AnnotationMethod.RULES.value,  # default to Rules Based
    user_id: int = None,
) -> Tuple[Dict, Dict]:
    annotations_json = create_annotations(
        annotation_method=annotation_method,
        specified_organism_synonym=specified_organism.organism_synonym if specified_organism else '',  # noqa
        specified_organism_tax_id=specified_organism.organism_taxonomy_id if specified_organism else '',  # noqa
        document=doc,
        filename=doc.filename
    )

    current_app.logger.debug(
        f'File successfully annotated: {doc.file_id}, {doc.filename}')

    update = {
        'id': doc.id,
        'annotations': annotations_json,
        'annotations_date': datetime.now(TIMEZONE),
    }

    if specified_organism:
        update['fallback_organism'] = specified_organism
        update['fallback_organism_id'] = specified_organism.id

    version = {
        'file_id': doc.id,
        'cause': cause,
        'custom_annotations': doc.custom_annotations,
        'excluded_annotations': doc.excluded_annotations,
        'user_id': user_id,
    }

    return update, version


@bp.route('/<string:project_name>', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_all_annotations_from_project(project_name):
    current_app.logger.info(
        f'Project: {project_name}',
        extra=UserEventLog(
            username=g.current_user.username, event_type='view entity word cloud').to_dict()
    )
    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found')
    user = g.current_user
    yield user, project
    annotation_service = get_manual_annotation_service()
    combined_annotations = annotation_service.get_combined_annotations_in_project(project.id)
    distinct_annotations = {}
    for annotation in combined_annotations:
        annotation_data = (
            annotation['meta']['id'],
            annotation['meta']['type'],
            annotation['meta']['allText'],
        )
        if distinct_annotations.get(annotation_data, None) is not None:
            distinct_annotations[annotation_data] += 1
        else:
            distinct_annotations[annotation_data] = 1
    sorted_distintct_annotations = sorted(
        distinct_annotations,
        key=lambda annotation: distinct_annotations[annotation],
        reverse=True,
    )
    result = 'entity_id\ttype\ttext\tcount\n'
    for annotation_data in sorted_distintct_annotations:
        result += f"{annotation_data[0]}\t{annotation_data[1]}\t{annotation_data[2]}\t{distinct_annotations[annotation_data]}\n"  # noqa
    response = make_response(result)
    response.headers['Content-Type'] = 'text/tsv'
    yield response


@bp.route('/<string:project_name>/<string:file_id>', methods=['POST'])
@auth.login_required
@jsonify_with_class(AnnotationRequest)
@requires_project_permission(AccessActionType.WRITE)
def annotate_file(req: AnnotationRequest, project_name: str, file_id: str):
    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()

    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found.')

    yield g.current_user, project

    doc = files_queries.get_all_files_and_content_by_id(
        file_ids=set([file_id]), project_id=project.id).one_or_none()

    if not doc:
        raise RecordNotFoundException(f'File with file id {file_id} not found.')

    fallback = None
    if req.organism:
        fallback = FallbackOrganism(
            organism_name=req.organism['organism_name'],
            organism_synonym=req.organism['synonym'],
            organism_taxonomy_id=req.organism['tax_id']
        )
        db.session.add(fallback)
        db.session.flush()

    update, version = annotate(
        doc=doc,
        cause=AnnotationChangeCause.SYSTEM_REANNOTATION,
        annotation_method=req.annotation_method,
        specified_organism=fallback
    )

    db.session.bulk_insert_mappings(FileAnnotationsVersion, [version])
    db.session.bulk_update_mappings(Files, [update])
    db.session.commit()
    yield SuccessResponse(
        result={
            'filenames': doc.filename,
            'status': 'Successfully annotated.'
        },
        status_code=200)


class AnnotationOutcome(Enum):
    ANNOTATED = 'Annotated'
    NOT_ANNOTATED = 'Not annotated'
    NOT_FOUND = 'Not found'


@bp.route('/<string:project_name>/reannotate', methods=['POST'])
@auth.login_required
@jsonify_with_class(AnnotationRequest)
@requires_project_permission(AccessActionType.WRITE)
def reannotate(req: AnnotationRequest, project_name: str):
    current_app.logger.info(
        f'Project: {project_name}',
        extra=UserEventLog(username=g.current_user.username, event_type='reannotate').to_dict()
    )
    user = g.current_user
    projects = Projects.query.filter(Projects.project_name == project_name).one_or_none()

    if projects is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    yield user, projects

    ids = set(req.file_ids)
    outcome: Dict[str, str] = {}  # file id to annotation outcome
    files = files_queries.get_all_files_and_content_by_id(
        file_ids=ids, project_id=projects.id).all()

    files_not_found = ids - set(f.file_id for f in files)
    for not_found in files_not_found:
        outcome[not_found] = AnnotationOutcome.NOT_FOUND.value

    updated_files: List[dict] = []
    versions: List[dict] = []

    for f in files:
        try:
            update, version = annotate(
                doc=f,
                cause=AnnotationChangeCause.USER_REANNOTATION,
                specified_organism=FallbackOrganism.query.get(f.fallback_organism_id))
        except AnnotationError as e:
            current_app.logger.error(
                'Could not reannotate file: %s, %s, %s', f.file_id, f.filename, e)
            outcome[f.file_id] = AnnotationOutcome.NOT_ANNOTATED.value
        else:
            updated_files.append(update)
            versions.append(version)
            current_app.logger.debug(
                'File successfully reannotated: %s, %s', f.file_id, f.filename)
            outcome[f.file_id] = AnnotationOutcome.ANNOTATED.value

    # low level fast bulk operation
    db.session.bulk_insert_mappings(FileAnnotationsVersion, versions)
    db.session.bulk_update_mappings(Files, updated_files)
    db.session.commit()
    yield SuccessResponse(result=outcome, status_code=200)


@bp.route('/global-list/inclusions')
@auth.login_required
@requires_role('admin')
def export_global_inclusions():
    yield g.current_user

    inclusions = GlobalList.query.filter_by(
        type=ManualAnnotationType.INCLUSION.value,
        reviewed=False
    ).all()

    def get_inclusion_for_review(inclusion):
        user = AppUser.query.filter_by(id=inclusion.annotation['user_id']).one_or_none()
        username = f'{user.first_name} {user.last_name}' if user is not None else 'not found'

        missing_data = any([
            inclusion.annotation['meta'].get('id', None) is None,
            inclusion.annotation['meta'].get('idHyperlink', None) is None
        ])

        if missing_data:
            current_app.logger.warning(
                f'Found inclusion in the global list with missing data:\n{inclusion.to_dict()}'
            )

        return {
            'id': inclusion.annotation['meta'].get('id', ''),
            'term': inclusion.annotation['meta']['allText'],
            'type': inclusion.annotation['meta']['type'],
            'hyperlink': inclusion.annotation['meta'].get('idHyperlink', ''),
            'inclusion_date': inclusion.annotation.get('inclusion_date', ''),
            'user': username,
        }

    data = [get_inclusion_for_review(inclusion) for inclusion in inclusions]

    exporter = get_excel_export_service()
    response = make_response(exporter.get_bytes(data), 200)
    response.headers['Content-Type'] = exporter.mimetype
    response.headers['Content-Disposition'] = \
        f'attachment; filename={exporter.get_filename("global_inclusions")}'
    yield response


@bp.route('/global-list/exclusions')
@auth.login_required
@requires_role('admin')
def export_global_exclusions():
    yield g.current_user

    exclusions = GlobalList.query.filter_by(
        type=ManualAnnotationType.EXCLUSION.value,
        reviewed=False,
    ).all()

    def get_exclusion_for_review(exclusion):
        user = AppUser.query.filter_by(id=exclusion.annotation['user_id']).one_or_none()
        username = f'{user.first_name} {user.last_name}' if user is not None else 'not found'

        missing_data = any([
            exclusion.annotation.get('text', None) is None,
            exclusion.annotation.get('type', None) is None,
            exclusion.annotation.get('idHyperlink', None) is None
        ])

        if missing_data:
            current_app.logger.warning(
                f'Found exclusion in the global list with missing data:\n{exclusion.to_dict()}'
            )

        return {
            'term': exclusion.annotation.get('text', ''),
            'type': exclusion.annotation.get('type', ''),
            'id_hyperlink': exclusion.annotation.get('idHyperlink', ''),
            'reason': exclusion.annotation['reason'],
            'comment': exclusion.annotation['comment'],
            'exclusion_date': exclusion.annotation['exclusion_date'],
            'user': username,
        }

    data = [get_exclusion_for_review(exclusion) for exclusion in exclusions]

    exporter = get_excel_export_service()
    response = make_response(exporter.get_bytes(data), 200)
    response.headers['Content-Type'] = exporter.mimetype
    response.headers['Content-Disposition'] = \
        f'attachment; filename={exporter.get_filename("global_exclusions")}'
    yield response


@bp.route('/global-list', methods=['GET'])
@auth.login_required
@requires_role('admin')
def get_annotations():

    yield g.current_user

    # Exclusions
    query_1 = db.session.query(
        FileContent.id,
        sa.sql.null().label('filename'),  # TODO: Subquery to get all linked files or download link?
        AppUser.email,
        GlobalList.id,
        GlobalList.type,
        GlobalList.reviewed,
        GlobalList.approved,
        GlobalList.creation_date,
        GlobalList.modified_date,
        GlobalList.annotation['text'].astext.label('text'),
        GlobalList.annotation['reason'].astext.label('reason'),
        GlobalList.annotation['type'].astext.label('entityType'),
        GlobalList.annotation['id'].astext.label('annotationId'),
        GlobalList.annotation['comment'].astext.label('comment')
    ).outerjoin(
        AppUser,
        AppUser.id == GlobalList.annotation['user_id'].as_integer()
    ).outerjoin(
        FileContent,
        FileContent.id == GlobalList.file_id
    ).filter(
        GlobalList.type == ManualAnnotationType.EXCLUSION.value
    )
    # Inclusions
    query_2 = db.session.query(
        FileContent.id,
        sa.sql.null().label('filename'),  # TODO: Subquery to get all linked files or download link?
        AppUser.email,
        GlobalList.id,
        GlobalList.type,
        GlobalList.reviewed,
        GlobalList.approved,
        GlobalList.creation_date,
        GlobalList.modified_date,
        GlobalList.annotation['meta']['allText'].astext.label('text'),
        sa.sql.null().label('reason'),
        GlobalList.annotation['meta']['type'].astext.label('entityType'),
        GlobalList.annotation['meta']['id'].astext.label('annotationId'),
        sa.sql.null().label('comment')
    ).outerjoin(
        AppUser,
        AppUser.id == GlobalList.annotation['user_id'].as_integer()
    ).outerjoin(
        FileContent,
        FileContent.id == GlobalList.file_id
    ).filter(GlobalList.type == ManualAnnotationType.INCLUSION.value)

    union_query = query_1.union(query_2)

    # TODO: Refactor to work with paginate_from_args
    limit = request.args.get('limit', 200)
    limit = min(200, int(limit))
    page = request.args.get('page', 1)
    page = max(1, int(page))

    # The order by clause is using a synthetic column
    # NOTE: We want to keep this ordering case insensitive
    query = union_query.order_by((sa.asc('text'))).paginate(page, limit, False)

    response = ResultList(
        total=query.total,
        results=[GlobalAnnotationData(
            file_id=r[0],
            filename=r[1],
            user_email=r[2],
            id=r[3],
            type=r[4],
            reviewed=r[5],
            approved=r[6],
            creation_date=r[7],
            modified_date=r[8],
            text=r[9],
            reason=r[10],
            entity_type=r[11],
            annotation_id=r[12],
            comment=r[13],
        ) for r in query.items],
        query=None)

    yield jsonify(response.to_dict())


@bp.route('/global-list', methods=['POST', 'DELETE'])
@auth.login_required
@use_kwargs(GlobalAnnotationsDeleteSchema)
@requires_role('admin')
def delete_global_annotations(pids):
    yield g.current_user

    query = GlobalList.__table__.delete().where(
        GlobalList.id.in_(pids)
    )
    try:
        db.session.execute(query)
    except SQLAlchemyError:
        db.session.rollback()
    else:
        db.session.commit()
        current_app.logger.info(
            f'Deleted {len(pids)} global annotations',
            UserEventLog(
                username=g.current_user.username, event_type='global annotation delete').to_dict()
        )
    yield jsonify(dict(result='success'))


@bp.route('/<string:project_name>/<string:file_id>', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_all_annotations_from_file(project_name, file_id):
    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    user = g.current_user

    # yield to requires_project_permission
    yield user, project

    manual_annotation_service = get_manual_annotation_service()
    combined_annotations = manual_annotation_service.get_combined_annotations(project.id, file_id)

    distinct_annotations = {}
    for annotation in combined_annotations:
        annotation_data = (
            annotation['meta']['id'],
            annotation['meta']['type'],
            annotation['meta']['allText'],
        )

        if distinct_annotations.get(annotation_data, None) is not None:
            distinct_annotations[annotation_data] += 1
        else:
            distinct_annotations[annotation_data] = 1

    sorted_distinct_annotations = sorted(
        distinct_annotations,
        key=lambda annotation: distinct_annotations[annotation],
        reverse=True
    )

    result = 'entity_id\ttype\ttext\tcount\n'
    for annotation_data in sorted_distinct_annotations:
        result += f"{annotation_data[0]}\t{annotation_data[1]}\t{annotation_data[2]}\t{distinct_annotations[annotation_data]}\n"  # noqa

    response = make_response(result)
    response.headers['Content-Type'] = 'text/tsv'

    yield response


@bp.route('/<string:project_name>/<string:file_id>/genes')
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_gene_list_from_file(project_name, file_id):
    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    user = g.current_user

    # yield to requires_project_permission
    yield user, project

    file = Files.query.filter_by(file_id=file_id, project=project.id).one_or_none()
    if not file:
        raise RecordNotFoundException('File does not exist')

    manual_annotation_service = get_manual_annotation_service()
    combined_annotations = manual_annotation_service.get_combined_annotations(project.id, file_id)
    gene_ids = {}
    for annotation in combined_annotations:
        if annotation['meta']['type'] == EntityType.GENE.value:
            gene_id = annotation['meta']['id']
            if gene_ids.get(gene_id, None) is not None:
                gene_ids[gene_id] += 1
            else:
                gene_ids[gene_id] = 1

    annotation_graph_service = AnnotationGraphService()
    gene_organism_pairs = annotation_graph_service.get_organisms_from_gene_ids(
        gene_ids=list(gene_ids.keys())
    )
    sorted_pairs = sorted(gene_organism_pairs, key=lambda pair: gene_ids[pair['gene_id']], reverse=True)  # noqa

    result = 'gene_id\tgene_name\torganism_id\torganism_name\tgene_annotation_count\n'
    for pair in sorted_pairs:
        result += f"{pair['gene_id']}\t{pair['gene_name']}\t{pair['taxonomy_id']}\t{pair['species_name']}\t{gene_ids[pair['gene_id']]}\n"  # noqa

    response = make_response(result)
    response.headers['Content-Type'] = 'text/tsv'

    yield response
