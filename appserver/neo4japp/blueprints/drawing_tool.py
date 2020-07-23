import io
import json
import os
from datetime import datetime

import graphviz as gv
from PyPDF4 import PdfFileReader, PdfFileWriter
from PyPDF4.generic import NameObject, ArrayObject
from flask import (
    current_app,
    request,
    Blueprint,
    g,
    Response,
    jsonify,
)
from flask_apispec import use_kwargs
from sqlalchemy import or_
from sqlalchemy.orm.exc import NoResultFound
from sqlalchemy_searchable import search
from werkzeug.utils import secure_filename

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_project_permission
from neo4japp.database import db
from neo4japp.exceptions import (
    InvalidFileNameException, RecordNotFoundException, NotAuthorizedException
)
from neo4japp.models import (
    AccessActionType,
    Project,
    ProjectSchema,
    Projects,
    Directory, ProjectBackup,
)
from neo4japp.constants import ANNOTATION_STYLES_DICT
from neo4japp.request_schemas.drawing_tool import ProjectBackupSchema

# TODO: LL-415 Migrate the code to the projects folder once GUI is complete and API refactored
from neo4japp.blueprints.projects import bp as newbp


bp = Blueprint('drawing_tool', __name__, url_prefix='/drawing-tool')


@newbp.route('/<string:projects_name>/map/<string:hash_id>', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_map_by_hash(hash_id: str, projects_name: str):
    """ Serve map by hash_id lookup """
    user = g.current_user

    projects = Projects.query.filter(Projects.project_name == projects_name).one()

    yield user, projects

    # Pull up map by hash_id
    try:
        project = Project.query.filter(
            Project.hash_id == hash_id,
        ).join(
            Directory,
            Directory.id == Project.dir_id,
        ).filter(
            Directory.projects_id == projects.id,
        ).one()
    except NoResultFound:
        raise RecordNotFoundException('not found :-( ')

    project_schema = ProjectSchema()

    yield jsonify({'project': project_schema.dump(project)})


@newbp.route('/<string:projects_name>/map/<string:hash_id>/download', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def download_map(hash_id: str, projects_name: str):
    """ Exports map to JSON format """
    user = g.current_user

    projects = Projects.query.filter(Projects.project_name == projects_name).one()

    yield user, projects

    try:
        project = Project.query.filter(
            Project.hash_id == hash_id,
        ).join(
            Directory,
            Directory.id == Project.dir_id,
        ).filter(
            Directory.projects_id == projects.id,
        ).one()
    except NoResultFound:
        raise RecordNotFoundException('not found :( ')

    project_data = json.dumps(project.graph)
    yield Response(
        project_data,
        mimetype='application/json',
        headers={'Content-Disposition': f'attachment;filename={project.label}.json'}
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
        date_modified=datetime.now(),
        graph=map_data,
        user_id=user.id,
        dir_id=dir_id,
    )

    db.session.add(drawing_map)
    db.session.flush()
    drawing_map.set_hash_id()
    db.session.commit()

    yield jsonify(result=dict(hashId=drawing_map.hash_id)), 200


@bp.route('/community', methods=['GET'])
@auth.login_required
def get_community_projects():
    # TODO: LL-415, what do we do with this now that we have projects?
    """ Return a list of all the projects made public by users """

    # Pull the projects that are made public
    projects = Project.query.filter_by(public=True).all()
    project_schema = ProjectSchema(many=True)

    return {'projects': project_schema.dump(projects)}, 200


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

    date_modified = datetime.strptime(
        data.get("date_modified", ""),
        "%Y-%m-%dT%H:%M:%S.%fZ"
    ) if data.get(
        "date_modified"
    ) is not None else datetime.now()

    # Create new project
    project = Project(
        author=f"{user.first_name} {user.last_name}",
        label=data.get("label", ""),
        description=data.get("description", ""),
        date_modified=date_modified,
        public=data.get("public", False),
        graph=data.get("graph", dict(nodes=[], edges=[])),
        user_id=user.id,
        dir_id=dir_id,
    )

    current_app.logger.info(f'User created map: <{g.current_user.email}:{project.label}>')

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
@requires_project_permission(AccessActionType.WRITE)
def update_project(hash_id: str, projects_name: str):
    """ Update the project's content and its metadata. """
    user = g.current_user
    data = request.get_json()

    projects = Projects.query.filter(Projects.project_name == projects_name).one_or_none()
    if projects is None:
        raise RecordNotFoundException(f'Project {projects_name} not found')

    yield user, projects

    try:
        project = Project.query.filter(
            Project.hash_id == hash_id,
        ).join(
            Directory,
            Directory.id == Project.dir_id,
        ).filter(
            Directory.projects_id == projects.id,
        ).one()
    except NoResultFound:
        raise RecordNotFoundException('not found :-( ')

    current_app.logger.info(f'User updated map: <{g.current_user.email}:{project.label}>')

    # Update project's attributes
    project.description = data.get("description", "")
    project.label = data.get("label", "")
    project.graph = data.get("graph", {"edges": [], "nodes": []})
    project.date_modified = datetime.now()
    project.public = data.get("public", False)



    # Commit to db
    db.session.add(project)
    db.session.commit()

    yield jsonify({'status': 'success'}), 200


@newbp.route('/<string:projects_name>/map/<string:hash_id>', methods=['DELETE'])
@auth.login_required
@requires_project_permission(AccessActionType.WRITE)
def delete_project(hash_id: str, projects_name: str):
    """ Delete object owned by user """
    user = g.current_user

    projects = Projects.query.filter(Projects.project_name == projects_name).one_or_none()
    if projects is None:
        raise RecordNotFoundException(f'Project {projects_name} not found')

    yield user, projects

    try:
        project = Project.query.filter(
            Project.hash_id == hash_id,
        ).join(
            Directory,
            Directory.id == Project.dir_id,
        ).filter(
            Directory.projects_id == projects.id,
        ).one()
    except NoResultFound:
        raise RecordNotFoundException('not found :-( ')

    # Commit to db
    db.session.delete(project)
    db.session.commit()

    yield jsonify({'status': 'success'}), 200


@newbp.route('/<string:projects_name>/map/<string:hash_id>/pdf', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_project_pdf(projects_name: str, hash_id: str):
    """ Gets a PDF file from the project drawing """

    unprocessed = []
    processed = {}
    processed_ids = []
    references = []

    user = g.current_user

    projects = Projects.query.filter(Projects.project_name == projects_name).one_or_none()
    if projects is None:
        raise RecordNotFoundException(f'Project {projects_name} not found')

    yield user, projects

    try:
        project = Project.query.filter(
            Project.hash_id == hash_id,
        ).join(
            Directory,
            Directory.id == Project.dir_id,
        ).filter(
            Directory.projects_id == projects.id,
        ).one()
    except NoResultFound:
        raise RecordNotFoundException('not found :-( ')

    unprocessed.append(project.hash_id)

    while len(unprocessed):
        item = unprocessed.pop(0)
        project = Project.query.filter_by(hash_id=item).one_or_none()
        if not project:
            raise RecordNotFoundException('No record found')
        pdf_data = process(project)
        pdf_object = PdfFileReader(io.BytesIO(pdf_data))
        processed[item] = pdf_object
        processed_ids.append(item)
        unprocessed_, references_ = get_references(pdf_object)
        unprocessed.extend([x for x in unprocessed_ if x not in unprocessed])
        references.extend(references_)

    for annot, hash_id in references:
        annot[NameObject('/Dest')] = ArrayObject([processed[hash_id].getPage(0).indirectRef,
                                                  NameObject('/Fit')])
        del (annot['/A'])

    yield merge_pdfs(processed, processed_ids)


def merge_pdfs(processed, pdf_list):
    final = PdfFileWriter()
    for pdf_id in pdf_list:
        final.addPage(processed[pdf_id].getPage(0))
    output = io.BytesIO()
    final.write(output)

    return output.getvalue()


def get_references(pdf_object):
    unprocessed = []
    references = []
    for x in pdf_object.getPage(0).get('/Annots', []):
        x = x.getObject()
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


@bp.route('/search', methods=['POST'])
@auth.login_required
def find_maps():
    # TODO: LL-415, what do we do with this now that we have projects?
    user = g.current_user
    data = request.get_json()
    query = search(Project.query, data['term'], sort=True)
    conditions = []

    filters = data.get('filters', {
        'personal': True,
        'community': True,
    })
    if filters.get('personal', True):
        conditions.append(Project.user_id == user.id)
    if filters.get('community', True):
        conditions.append(Project.public)

    if len(conditions):
        projects = query.filter(or_(*conditions)).all()
        project_schema = ProjectSchema(many=True)

        return {'projects': project_schema.dump(projects)}, 200
    else:
        return {'projects': []}, 200


@newbp.route('/<string:projects_name>/map/<string:hash_id>/<string:format>', methods=['GET'])
@auth.login_required
@requires_project_permission(AccessActionType.READ)
def get_project_image(projects_name: str, hash_id: str, format: str):
    # TODO: LL-415, what do we do with this now that we have projects?
    """ Gets a image file from the project drawing """
    user = g.current_user

    projects = Projects.query.filter(Projects.project_name == projects_name).one_or_none()
    if projects is None:
        raise RecordNotFoundException(f'Project {projects_name} not found')

    yield user, projects

    try:
        project = Project.query.filter(
            Project.hash_id == hash_id,
            ).join(
            Directory,
            Directory.id == Project.dir_id,
            ).filter(
            Directory.projects_id == projects.id,
            ).one()
    except NoResultFound:
        raise RecordNotFoundException('not found :-( ')

    yield process(project, format)


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
        f'User getting a backup: <{g.current_user.email}:{backup.hash_id}>')
    return {
        'id': backup.project_id,
        'label': backup.label,
        'description': backup.description,
        'date_modified': backup.date_modified,
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
    backup.date_modified = data["date_modified"]
    backup.graph = data["graph"]
    backup.author = data["author"]
    backup.public = data["public"]
    backup.user_id = data["user_id"]
    backup.hash_id = data["hash_id"]

    db.session.add(backup)
    db.session.commit()

    current_app.logger.info(
        f'User added a backup: <{g.current_user.email}:{backup.hash_id}>')
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
            f'User deleted a backup: <{g.current_user.email}:{backup.hash_id}>')
    return ''
