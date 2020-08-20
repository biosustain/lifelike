import os

from flask import Blueprint, current_app, g, make_response

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import (
    requires_role,
    requires_project_permission
)
from neo4japp.database import (
    db,
    get_excel_export_service,
    get_manual_annotations_service,
    get_neo4j_service_dao,
)
from neo4japp.exceptions import (
    DatabaseError,
    RecordNotFoundException
)
from neo4japp.models import (
    AccessActionType,
    AppUser,
    FileContent,
    Files,
    GlobalList,
    InclusionExclusionType,
    Projects
)
from neo4japp.services.annotations.constants import EntityType

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
            hyperlink = f'{domain}/api/files/download/{inclusion.file_id}'

        missing_data = any([
            inclusion.annotation['meta'].get('id', None) is None,
            inclusion.annotation['meta'].get('primaryLink', None) is None
        ])

        if missing_data:
            current_app.logger.warning(
                f'Found inclusion in the global list with missing data:\n{inclusion.to_dict()}'
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
            hyperlink = f'{domain}/api/files/download/{exclusion.file_id}'

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
            'hyperlink': hyperlink
        }

    data = [get_exclusion_for_review(exclusion) for exclusion in exclusions]

    exporter = get_excel_export_service()
    response = make_response(exporter.get_bytes(data), 200)
    response.headers['Content-Type'] = exporter.mimetype
    response.headers['Content-Disposition'] = \
        f'attachment; filename={exporter.get_filename("global_exclusions")}'
    yield response


@bp.route('/<string:project_name>/<string:file_id>')
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_all_annotations_from_file(project_name, file_id):
    project = Projects.query.filter(Projects.project_name == project_name).one_or_none()
    if project is None:
        raise RecordNotFoundException(f'Project {project_name} not found')

    user = g.current_user

    # yield to requires_project_permission
    yield user, project

    file = Files.query.filter_by(file_id=file_id, project=project.id).one_or_none()
    if not file:
        raise RecordNotFoundException('File does not exist')

    manual_annotations_service = get_manual_annotations_service()
    combined_annotations = manual_annotations_service.get_combined_annotations(project.id, file_id)

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

    manual_annotations_service = get_manual_annotations_service()
    combined_annotations = manual_annotations_service.get_combined_annotations(project.id, file_id)
    gene_ids = {}
    for annotation in combined_annotations:
        if annotation['meta']['type'] == EntityType.Gene.value:
            gene_id = annotation['meta']['id']
            if gene_ids.get(gene_id, None) is not None:
                gene_ids[gene_id] += 1
            else:
                gene_ids[gene_id] = 1

    neo4j = get_neo4j_service_dao()
    gene_organism_pairs = neo4j.get_organisms_from_gene_ids(
        gene_ids=list(gene_ids.keys())
    )
    sorted_pairs = sorted(gene_organism_pairs, key=lambda pair: gene_ids[pair['gene_id']], reverse=True)  # noqa

    result = 'gene_id\tgene_name\torganism_id\torganism_name\tgene_annotation_count\n'
    for pair in sorted_pairs:
        result += f"{pair['gene_id']}\t{pair['gene_name']}\t{pair['taxonomy_id']}\t{pair['species_name']}\t{gene_ids[pair['gene_id']]}\n"  # noqa

    response = make_response(result)
    response.headers['Content-Type'] = 'text/tsv'

    yield response
