import io
import os
import json
from datetime import datetime

from flask import request, Blueprint, g, Response, jsonify
from werkzeug.utils import secure_filename

from sqlalchemy.orm.exc import NoResultFound
from sqlalchemy_searchable import search

from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_role
from neo4japp.database import db
from neo4japp.data_transfer_objects import DrawingUploadRequest
from neo4japp.exceptions import InvalidFileNameException, RecordNotFoundException
from neo4japp.models import Project, ProjectSchema
from neo4japp.constants import ANNOTATION_STYLES_DICT

import graphviz as gv
from PyPDF4 import PdfFileReader, PdfFileWriter
from PyPDF4.generic import NameObject, ArrayObject


bp = Blueprint('drawing_tool', __name__, url_prefix='/drawing-tool')


@bp.route('/map/<string:hash_id>', methods=['GET'])
@auth.login_required
def get_map_by_hash(hash_id):
    """
        Serve map by hash_id lookup
    """
    user = g.current_user

    # Pull up map by hash_id
    try:
        project = Project.query.filter_by(hash_id=hash_id).one()
    except NoResultFound:
        raise RecordNotFoundException('not found :-( ')

    project_schema = ProjectSchema()

    # Send regardless if map is owned by user or public
    if (project.user_id == user.id or project.public):
        return {'project': project_schema.dump(project)}, 200
    # Else complain to user not fonud
    else:
        raise RecordNotFoundException('not found :-( ')


@bp.route('/map/download/<string:hash_id>', methods=['GET'])
@auth.login_required
@requires_role('admin')
def download_map(hash_id):
    """ Exports map to JSON format """
    user = g.current_user

    yield user

    try:
        project = Project.query.filter_by(hash_id=hash_id).one()
    except NoResultFound:
        raise RecordNotFoundException('not found :( ')

    if (project.user_id == user.id or project.public):
        project_data = json.dumps(project.graph)
        yield Response(
            project_data,
            mimetype='application/json',
            headers={'Content-Disposition': f'attachment;filename={project.label}.json'}
        )
    else:
        raise RecordNotFoundException('not found :-( ')


@bp.route('/map/upload', methods=['POST'])
@auth.login_required
@requires_role('admin')
def upload_map():

    proj_name = request.form['projectName']
    proj_description = request.form['description']

    user = g.current_user

    yield user

    map_file = request.files['fileInput']
    filename = secure_filename(map_file.filename)
    _, extension = os.path.splitext(filename)
    if extension != '.json':
        raise InvalidFileNameException('Only .json files are accepted')
    map_data = json.load(map_file)
    drawing_map = Project(
        author=f'{user.first_name} {user.last_name}',
        label=proj_name,
        description=proj_description,
        date_modified=datetime.now(),
        graph=map_data,
        user_id=user.id,
    )

    db.session.add(drawing_map)
    db.session.flush()
    drawing_map.set_hash_id()
    db.session.commit()

    yield jsonify(result=dict(hashId=drawing_map.hash_id)), 200


@bp.route('/community', methods=['GET'])
@auth.login_required
def get_community_projects():
    """
        Return a list of all the projects made public by users
    """

    # Pull the projects that are made public
    projects = Project.query.filter_by(public=True).all()
    project_schema = ProjectSchema(many=True)

    return {'projects': project_schema.dump(projects)}, 200


@bp.route('/projects', methods=['GET'])
@auth.login_required
def get_project():
    """
        Return a list of all projects underneath user
    """
    user = g.current_user

    # Pull the projects tied to that user

    # TODO - add pagination : LL-343 in Backlog
    projects = Project.query.filter_by(user_id=user.id).all()
    project_schema = ProjectSchema(many=True)

    return {'projects': project_schema.dump(projects)}, 200


@bp.route('/projects', methods=['POST'])
@auth.login_required
def add_project():
    """
        Create a new projecrt under a user
    """
    data = request.get_json()
    user = g.current_user

    # Create new project
    project = Project(
        author=f"{user.first_name} {user.last_name}",
        label=data.get("label", ""),
        description=data.get("description", ""),
        date_modified=datetime.strptime(
            data.get("date_modified", ""),
            "%Y-%m-%dT%H:%M:%S.%fZ"
        ),
        graph=data.get("graph", {"graph": [], "edges": []}),
        user_id=user.id
    )

    # Flush it to database to that user
    db.session.add(project)
    db.session.flush()

    # Assign hash_id to map
    project.set_hash_id()

    db.session.commit()

    project_schema = ProjectSchema()

    return {
        'status': 'success',
        'project': project_schema.dump(project)
    }


@bp.route('/projects/<string:project_id>', methods=['PUT'])
@auth.login_required
def update_project(project_id):
    """
        Update the project's content and its metadata.
    """
    user = g.current_user
    data = request.get_json()

    # Pull up project by id
    project = Project.query.filter_by(
        id=project_id,
        user_id=user.id
    ).first_or_404()

    # Update project's attributes
    project.description = data.get("description", "")
    project.label = data.get("label", "")
    project.graph = data.get("graph", {"edges": [], "nodes": []})
    project.date_modified = datetime.now()
    project.public = data.get("public", False)

    # Commit to db
    db.session.add(project)
    db.session.commit()

    return {'status': 'success'}, 200


@bp.route('/projects/<string:project_id>', methods=['delete'])
@auth.login_required
def delete_project(project_id):
    """
        Delete object owned by user
    """
    user = g.current_user

    # Pull up project by id
    project = Project.query.filter_by(
        id=project_id,
        user_id=user.id
    ).first_or_404()

    # Commit to db
    db.session.delete(project)
    db.session.commit()

    return {'status': 'success'}, 200


@bp.route('/projects/<string:project_id>/pdf', methods=['get'])
@auth.login_required
def get_project_pdf(project_id):
    """
    Gets a PDF file from the project drawing
    """

    unprocessed = []
    processed = {}
    processed_ids = []
    references = []

    user = g.current_user

    # Pull up project by id
    data_source = Project.query.filter_by(
        id=project_id,
        user_id=user.id
    ).first_or_404()

    unprocessed.append(data_source.hash_id)

    while len(unprocessed):
        item = unprocessed.pop(0)
        project = Project.query.filter_by(hash_id=item).one_or_none()
        if not project:
            raise RecordNotFoundException()
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
        del(annot['/A'])

    return merge_pdfs(processed, processed_ids)


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
    user = g.current_user
    data = request.get_json()
    query = search(Project.query, data['term'], sort=True)
    personal = query.filter_by(user_id=user.id).all()
    community = query.filter_by(public=True).all()
    project_schema = ProjectSchema(many=True)

    return {'projects': project_schema.dump(personal) + project_schema.dump(community)}, 200


@bp.route('/projects/<string:project_id>/<string:format>', methods=['get'])
@auth.login_required
def get_project_image(project_id, format):
    """
    Gets a image file from the project drawing
    """
    user = g.current_user

    # Pull up project by id
    data_source = Project.query.filter_by(
        id=project_id,
        user_id=user.id
    ).first_or_404()

    return process(data_source, format)
