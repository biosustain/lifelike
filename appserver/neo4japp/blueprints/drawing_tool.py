import io
import json
import os
import re
from datetime import datetime

import graphviz as gv
from PyPDF4 import PdfFileReader, PdfFileWriter
from PyPDF4.generic import NameObject, ArrayObject
from fastjsonschema import JsonSchemaException
from flask import (
    current_app,
    request,
    Blueprint,
    g,
    Response,
    jsonify,
)
from flask_apispec import use_kwargs
from sqlalchemy import or_, func
from sqlalchemy.orm import joinedload, aliased, contains_eager
from sqlalchemy.orm.exc import NoResultFound
from werkzeug.utils import secure_filename

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_project_permission, check_project_permission
# TODO: LL-415 Migrate the code to the projects folder once GUI is complete and API refactored
from neo4japp.blueprints.projects import bp as newbp
from neo4japp.constants import ANNOTATION_STYLES_DICT
from neo4japp.constants import TIMEZONE
# TODO: LL-415 Migrate the code to the projects folder once GUI is complete and API refactored
from neo4japp.data_transfer_objects import PublicMap
from neo4japp.data_transfer_objects.common import ResultList
from neo4japp.database import (
    db,
    get_authorization_service,
    get_projects_service,
)
from neo4japp.exceptions import (
    InvalidFileNameException, RecordNotFoundException,
    NotAuthorizedException, InvalidArgumentsException
)
from neo4japp.models import (
    AccessActionType,
    Project,
    ProjectVersion,
    Projects,
    Directory,
    ProjectBackup,
    AppUser,
)
from neo4japp.models.schema import ProjectSchema, ProjectVersionSchema
from neo4japp.request_schemas.drawing_tool import ProjectBackupSchema
from neo4japp.request_schemas.filesystem import MoveFileRequest, DirectoryDestination
from neo4japp.schemas.formats.drawing_tool import validate_map
from neo4japp.util import CasePreservedDict
from neo4japp.utils.logger import UserEventLog
from neo4japp.utils.request import paginate_from_args

bp = Blueprint('drawing_tool', __name__, url_prefix='/drawing-tool')


def get_map(hash_id: str, user: AppUser, check_access: AccessActionType):
    t_owner = aliased(AppUser)
    t_directory = aliased(Directory)
    t_project = aliased(Projects)

    map_query = db.session.query(Project) \
        .join(t_owner, t_owner.id == Project.user_id) \
        .join(t_directory, t_directory.id == Project.dir_id) \
        .join(t_project, t_project.id == t_directory.projects_id) \
        .options(contains_eager(Project.user, alias=t_owner),
                 contains_eager(Project.dir, alias=t_directory)
                 .contains_eager(Directory.project, t_project)) \
        .filter(Project.hash_id == hash_id)

    # Pull up map by hash_id
    try:
        map = map_query.one()
    except NoResultFound:
        raise RecordNotFoundException('Map not found.')

    check_project_permission(map.dir.project, user, check_access)

    return map


@newbp.route('/<string:projects_name>/map/<string:hash_id>', methods=['GET'])
@auth.login_required
def get_map_by_hash(hash_id: str, projects_name: str):
    """
    Get a map by its hash.
    """

    map = get_map(hash_id, g.current_user, AccessActionType.READ)
    map_schema = ProjectSchema()

    return jsonify({'project': map_schema.dump(map)})


@newbp.route('/<string:projects_name>/map/<string:hash_id>/download', methods=['GET'])
@auth.login_required
def download_map(hash_id: str, projects_name: str):
    """ Exports map to JSON format """
    map = get_map(hash_id, g.current_user, AccessActionType.READ)

    project_data = json.dumps(map.graph)
    return Response(
        project_data,
        mimetype='application/json',
        headers={'Content-Disposition': f'attachment;filename={map.label}.json'}
    )


@newbp.route('/<string:projects_name>/map/upload', methods=['POST'])
@auth.login_required
@requires_project_permission(AccessActionType.WRITE)
def upload_map(projects_name: str):
    draw_proj_name = request.form['projectName']
    proj_description = request.form['description']
    dir_id = request.form['dirId']

    user = g.current_user

    projects = Projects.query.filter(Projects.project_name == projects_name).one()

    yield user, projects

    map_file = request.files['fileInput']
    filename = secure_filename(map_file.filename)
    _, extension = os.path.splitext(filename)
    if extension != '.json':
        raise InvalidFileNameException('Only .json files are accepted')
    map_data = json.load(map_file)
    drawing_map = Project(
        author=f'{user.first_name} {user.last_name}',
        label=draw_proj_name,
        description=proj_description,
        modified_date=datetime.now(),
        graph=map_data,
        user_id=user.id,
        dir_id=dir_id,
        creation_date=datetime.now(TIMEZONE),
    )

    db.session.add(drawing_map)
    db.session.flush()
    drawing_map.set_hash_id()
    db.session.commit()

    return jsonify(result={'hashId': drawing_map.hash_id}), 200


@bp.route('/community', methods=['GET'])
@auth.login_required
def get_community_projects():
    """ Return a list of all the projects made public by users """

    query = Project.query \
        .options(joinedload(Project.user),
                 joinedload(Project.dir),
                 joinedload(Project.dir, Directory.project)) \
        .filter(Project.public.is_(True))

    filter_query = request.args.get('q', '').strip()
    if len(filter_query):
        query = query.filter(or_(
            func.lower(Project.label).contains(func.lower(filter_query)),
            func.lower(Project.description).contains(func.lower(filter_query))
        ))

    query = paginate_from_args(
        query,
        request.args,
        columns={
            'dateModified': Project.modified_date,
            'label': Project.label,
        },
        default_sort='label',
        upper_limit=200
    )

    response = ResultList(
        total=query.total,
        results=[
            PublicMap(
                map=CasePreservedDict(o.to_dict(exclude=[
                    'graph',
                    'search_vector'
                ], keyfn=lambda x: x)),
                user=o.user.to_dict(
                    exclude=[
                        'first_name', 'last_name', 'email', 'roles',
                    ],
                ),
                project=o.dir.project
            ) for o in query.items
        ],
        query=None)

    return jsonify(response.to_dict())


@bp.route('/projects', methods=['GET'])
@auth.login_required
def get_project():
    # TODO: LL-415, what do we do with this now that we have projects?
    """ Return a list of all projects underneath user """
    user = g.current_user

    # Pull the projects tied to that user

    # TODO - add pagination : LL-343 in Backlog
    projects = Project.query.filter_by(user_id=user.id).all()
    project_schema = ProjectSchema(many=True)

    return {'projects': project_schema.dump(projects)}, 200


@newbp.route('/<string:projects_name>/map', methods=['POST'])
@auth.login_required
@requires_project_permission(AccessActionType.WRITE)
def add_project(projects_name: str):
    """ Create a new project under a user """
    data = request.get_json()
    user = g.current_user

    projects = Projects.query.filter(Projects.project_name == projects_name).one()

    dir_id = data['directoryId']

    try:
        directory = Directory.query.get(dir_id)
        projects = Projects.query.get(directory.projects_id)
    except NoResultFound as err:
        raise RecordNotFoundException(f'No record found: {err}')

    yield user, projects

    graph = data.get("graph", {'nodes': [], 'edges': []})

    try:
        validate_map(graph)
    except JsonSchemaException as e:
        raise InvalidArgumentsException(f'There is something wrong with the map data and '
                                        f'it cannot be saved. {e.message}') from e

    modified_date = datetime.strptime(
        data.get('modified_date', ''),
        '%Y-%m-%dT%H:%M:%S.%fZ'
    ) if data.get(
        'modified_date'
    ) is not None else datetime.now()

    # Create new project
    project = Project(
        author=f'{user.first_name} {user.last_name}',
        label=data.get('label', ''),
        description=data.get('description', ''),
        modified_date=modified_date,
        public=data.get("public", False),
        graph=graph,
        user_id=user.id,
        dir_id=dir_id,
        creation_date=datetime.now(TIMEZONE),
    )

    current_app.logger.info(
        f'User created map: <{project.label}>',
        extra=UserEventLog(username=g.current_user.username, event_type='map create').to_dict())

    # If we end up changing this so that either hash_id is removed or otherwise generated
    # before the map is inserted, we will need to update the on_update and on_insert triggers
    # in the class definition.

    # Flush it to database to that user
    db.session.add(project)
    db.session.flush()

    # Assign hash_id to map
    project.set_hash_id()

    db.session.commit()

    project_schema = ProjectSchema()

    yield jsonify({
        'status': 'success',
        'project': project_schema.dump(project)
    })


@newbp.route('/<string:projects_name>/map/<string:hash_id>', methods=['PATCH'])
@auth.login_required
def update_project(hash_id: str, projects_name: str):
    """ Update the project's content and its metadata. """
    user = g.current_user
    data = request.get_json()

    map = get_map(hash_id, g.current_user, AccessActionType.WRITE)

    current_app.logger.info(
        f'User updated map: <{map.label}>',
        extra=UserEventLog(username=g.current_user.username, event_type='map update').to_dict())

    # Create new project version
    project_version = ProjectVersion(
        label=map.label,
        description=map.description,
        modified_date=datetime.now(),
        public=map.public,
        graph=map.graph,
        user_id=user.id,
        dir_id=map.dir_id,
        project_id=map.id,
    )

    # Update project's attributes
    if 'description' in data:
        map.description = data['description']
    if 'label' in data:
        map.label = data['label']
    if 'graph' in data:
        try:
            validate_map(data['graph'])
        except JsonSchemaException as e:
            raise InvalidArgumentsException(f'There is something wrong with the map data and '
                                            f'it cannot be saved. {e.message}') from e

        map.graph = data['graph']
    if not map.graph:
        map.graph = {"edges": [], "nodes": []}
    map.modified_date = datetime.now()
    if 'public' in data:
        map.public = data['public']

    # Commit to db
    db.session.add(map)
    db.session.add(project_version)
    db.session.commit()

    return jsonify({'status': 'success'}), 200


@newbp.route('/<string:projects_name>/map/<string:hash_id>', methods=['DELETE'])
@auth.login_required
def delete_project(hash_id: str, projects_name: str):
    """ Delete object owned by user """
    map = get_map(hash_id, g.current_user, AccessActionType.WRITE)

    # Commit to db
    db.session.delete(map)
    db.session.commit()

    return jsonify({'status': 'success'}), 200


@bp.route('/<string:projects_name>/map/<string:hash_id>/version/', methods=['GET'])
@auth.login_required
def get_versions(projects_name: str, hash_id: str):
    """ Return a list of all map versions underneath map """
    user = g.current_user

    map = get_map(hash_id, g.current_user, AccessActionType.READ)

    project_versions = ProjectVersion.query.with_entities(
        ProjectVersion.id, ProjectVersion.modified_date).filter(
        ProjectVersion.project_id == map.id
    ).all()

    version_schema = ProjectVersionSchema(many=True)

    return jsonify({'versions': version_schema.dump(project_versions)}), 200


@bp.route('/<string:projects_name>/map/<string:hash_id>/version/<version_id>', methods=['GET'])
@auth.login_required
def get_version(projects_name: str, hash_id: str, version_id):
    """ Return a list of all map versions underneath map """
    map = get_map(hash_id, g.current_user, AccessActionType.READ)

    try:
        project_version = ProjectVersion.query.filter(
            ProjectVersion.id == version_id,
            ProjectVersion.project_id == map.id,
        ).one()
    except NoResultFound:
        raise RecordNotFoundException('not found :-( ')

    version_schema = ProjectVersionSchema()

    return jsonify({'version': version_schema.dump(project_version)}), 200


@newbp.route('/<string:projects_name>/map/<string:hash_id>/pdf', methods=['GET'])
@auth.login_required
def get_project_pdf(projects_name: str, hash_id: str):
    """ Gets a PDF file from the project drawing """

    user = g.current_user
    auth_service = get_authorization_service()
    project_service = get_projects_service()
    private_data_access = auth_service.has_role(user, 'private-data-access')

    hash_id_queue = [hash_id]
    seen_hash_ids = set()
    map_pdfs = {}
    pdf_map_links = []

    while len(hash_id_queue):
        current_hash_id = hash_id_queue.pop(0)

        try:
            project = Project.query \
                .options(joinedload(Project.user),
                         joinedload(Project.dir),
                         joinedload(Project.dir, Directory.project)) \
                .filter(Project.hash_id == current_hash_id) \
                .one()

            # Check permission
            if not private_data_access:
                role = project_service.has_role(user, project.dir.project)
                if role is None or not auth_service.is_allowed(role, AccessActionType.READ,
                                                               project.dir.project):
                    raise NotAuthorizedException('No permission to read linked map')

            pdf_data = process(project)
            pdf_object = PdfFileReader(io.BytesIO(pdf_data), strict=False)
            map_pdfs[current_hash_id] = pdf_object

            # Search through map links in the PDF and find related maps we should add to the PDF
            unprocessed_, references_ = get_references(pdf_object)
            pdf_map_links.extend(references_)

            hash_id_queue.extend([x for x in unprocessed_ if x not in seen_hash_ids])
            seen_hash_ids.update([x for x in unprocessed_ if x not in seen_hash_ids])
        except (NoResultFound, NotAuthorizedException):
            if current_hash_id == hash_id:
                # If it's the ***ARANGO_USERNAME*** map requested, we need to fail early
                raise RecordNotFoundException('Requested map not found or cannot be read')
            else:
                # If it's a linked map and we can't load it, just don't add it to the PDF
                continue

    for object, hash_id in pdf_map_links:
        if hash_id in map_pdfs:
            object[NameObject('/Dest')] = ArrayObject([map_pdfs[hash_id].getPage(0).indirectRef,
                                                       NameObject('/Fit')])
            del (object['/A'])

    return merge_pdfs(map_pdfs)


def merge_pdfs(processed):
    final = PdfFileWriter()
    for pdf_id in processed:
        final.addPage(processed[pdf_id].getPage(0))
    output = io.BytesIO()
    final.write(output)

    return output.getvalue()


def get_references(pdf_object):
    unprocessed = []
    references = []
    map_link_pattern = re.compile("^/projects/([^/]+)/maps/([^/]+)")
    for x in pdf_object.getPage(0).get('/Annots', []):
        x = x.getObject()
        m = map_link_pattern.search(x['/A']['/URI'])
        if m:
            unprocessed.append(m.group(2))
            references.append((x, m.group(2)))
        if 'dt/map/' in x['/A']['/URI']:
            id = x['/A']['/URI'].split('map/')[-1]
            unprocessed.append(id)
            references.append((x, id))

    return unprocessed, references


def process(data_source, format='pdf'):
    json_graph = data_source.graph
    graph_attr = [('margin', '3')]
    if format == 'png':
        graph_attr.append(('dpi', '300'))
    graph = gv.Digraph(
        data_source.label,
        comment=data_source.description,
        engine='neato',
        graph_attr=graph_attr,
        format=format)

    for node in json_graph['nodes']:
        params = {
            'name': node['hash'],
            'label': node['display_name'],
            'pos': f"{node['data']['x'] / 55},{-node['data']['y'] / 55}!",
            'shape': 'box',
            'style': 'rounded',
            'color': '#2B7CE9',
            'fontcolor': ANNOTATION_STYLES_DICT.get(node['label'], {'color': 'black'})['color'],
            'fontname': 'sans-serif',
            'margin': "0.2,0.0"
        }

        if node['label'] in ['map', 'link', 'note']:
            label = node['label']
            params['image'] = f'/home/n4j/assets/{label}.png'
            params['labelloc'] = 'b'
            params['forcelabels'] = "true"
            params['imagescale'] = "both"
            params['color'] = '#ffffff00'

        if node['label'] in ['association', 'correlation', 'cause', 'effect', 'observation']:
            params['color'] = ANNOTATION_STYLES_DICT.get(
                node['label'],
                {'color': 'black'})['color']
            params['fillcolor'] = ANNOTATION_STYLES_DICT.get(
                node['label'],
                {'color': 'black'})['color']
            params['fontcolor'] = 'black'
            params['style'] = 'rounded,filled'

        if 'hyperlink' in node['data'] and node['data']['hyperlink']:
            params['href'] = node['data']['hyperlink']
        if 'source' in node['data'] and node['data']['source']:
            params['href'] = node['data']['source']

        graph.node(**params)

    for edge in json_graph['edges']:
        graph.edge(
            edge['from'],
            edge['to'],
            edge['label'],
            color='#2B7CE9'
        )

    return graph.pipe()


@newbp.route('/<string:projects_name>/map/<string:hash_id>/<string:format>', methods=['GET'])
@auth.login_required
def get_project_image(projects_name: str, hash_id: str, format: str):
    # TODO: LL-415, what do we do with this now that we have projects?
    """ Gets a image file from the project drawing """
    map = get_map(hash_id, g.current_user, AccessActionType.READ)

    return process(map, format)


@bp.route('/map/<string:hash_id>/backup', methods=['GET'])
@auth.login_required
def project_backup_get(hash_id):
    backup = ProjectBackup.query.filter_by(
        hash_id=hash_id,
        user_id=g.current_user.id,
    ).one_or_none()
    if backup is None:
        raise RecordNotFoundException('No backup found.')
    current_app.logger.info(
        'User getting a backup',
        extra=UserEventLog(username=g.current_user.username, event_type='map get backup').to_dict())
    return {
        'id': backup.project_id,
        'label': backup.label,
        'description': backup.description,
        'modified_date': backup.modified_date,
        'graph': backup.graph,
        'author': backup.author,
        'public': backup.public,
        'user_id': backup.user_id,
        'hash_id': backup.hash_id,
    }


@bp.route('/map/<string:hash_id_>/backup', methods=['POST'])
@auth.login_required
@use_kwargs(ProjectBackupSchema)
def project_backup_post(hash_id_, **data):
    # `hash_id_` instead of `hash_id`, otherwise flask_apispec will:
    # hash_id = data.pop('hash_id')
    # hence replacing the URL parameter's value, which incidentally has the same
    # name as one of `data`'s keys
    project = Project.query.filter_by(
        hash_id=hash_id_,
        user_id=g.current_user.id,
    ).one_or_none()

    # Make sure that the person who's trying to save a backup has access
    # to the project
    if project is None:
        raise NotAuthorizedException('Wrong project id or you do not own the project.')

    graph = data.get("graph", {'nodes': [], 'edges': []})

    try:
        validate_map(graph)
    except JsonSchemaException as e:
        current_app.logger.info(
            f'Map backup data validation error: {project.id}',
            extra=UserEventLog(username=g.current_user.username,
                               event_type='map backup').to_dict()
        )

    old_backup = ProjectBackup.query.filter_by(
        hash_id=hash_id_,
        user_id=g.current_user.id,
    ).one_or_none()

    if old_backup is not None:
        db.session.delete(old_backup)

    backup = ProjectBackup()
    backup.project_id = data["id"]
    backup.label = data["label"]
    backup.description = data["description"]
    backup.modified_date = data["modified_date"]
    backup.graph = data["graph"]
    backup.author = data["author"]
    backup.public = data["public"]
    backup.user_id = data["user_id"]
    backup.hash_id = data["hash_id"]

    db.session.add(backup)
    db.session.commit()
    current_app.logger.info(
        'User added a backup',
        extra=UserEventLog(username=g.current_user.username, event_type='map add backup').to_dict())
    return ''


@bp.route('/map/<string:hash_id>/backup', methods=['DELETE'])
@auth.login_required
def project_backup_delete(hash_id):
    backup = ProjectBackup.query.filter_by(
        hash_id=hash_id,
        user_id=g.current_user.id,
    ).one_or_none()
    if backup is not None:
        db.session.delete(backup)
        db.session.commit()
        current_app.logger.info(
            'User deleted a backup',
            extra=UserEventLog(
                username=g.current_user.username, event_type='map delete backup').to_dict())
    return ''


@newbp.route('/<string:project_name>/maps/<string:hash_id>/move', methods=['POST'])
@auth.login_required
@use_kwargs(MoveFileRequest)
def move_map(destination: DirectoryDestination, hash_id: str, project_name: str):
    user = g.current_user

    target_map = get_map(hash_id, g.current_user, AccessActionType.READ)

    destination_dir, destination_project = db.session.query(Directory, Projects) \
        .join(Projects, Projects.id == Directory.projects_id) \
        .filter(Directory.id == destination['directoryId']) \
        .one()

    if destination_project.id != target_map.dir.project.id:
        check_project_permission(destination_project, user, AccessActionType.WRITE)

    if target_map.dir.id == destination_dir.id:
        raise InvalidArgumentsException(
            'The destination directory is the same as the current directory.')

    target_map.dir_id = destination_dir.id
    db.session.commit()

    return jsonify({
        'success': True,
    })
