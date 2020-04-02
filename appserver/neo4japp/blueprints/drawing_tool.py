from datetime import datetime, timedelta
from flask import current_app, request, Response, json, Blueprint, g
import jwt

from neo4japp.blueprints.auth import auth
from neo4japp.database import db
from neo4japp.models import AppUser, Project, ProjectSchema

import graphviz as gv

bp = Blueprint('drawing_tool', __name__, url_prefix='/drawing-tool')


@bp.route('/projects', methods=['GET'])
@auth.login_required
def get_project():
    """
        Return a list of all projects underneath user
    """
    user = g.current_user

    # Pull the projects tied to that user
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
        label=data.get("label", ""),
        description=data.get("description", ""),
        date_modified=datetime.strptime(
            data.get("date_modified", ""),
            "%Y-%m-%dT%H:%M:%S.%fZ"
        ),
        graph=data.get("graph", {"graph": [], "edges": []}),
        user_id=user.id
    )

    # Commit it to database to that user
    db.session.add(project)
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

    colormap = {
        'disease': "#F3AB4A",
        'species': '#3177B8',
        'chemical': '#71B267',
        'gene': '#563A9F',
        'study': '#005662',
        'observation': '#9A0007',
        'entity': 'black'
    }

    user = g.current_user

    # Pull up project by id
    data_source = Project.query.filter_by(
        id=project_id,
        user_id=user.id
    ).first_or_404()

    json_graph = data_source.graph
    graph = gv.Digraph('POC', comment=data_source.description, engine='neato', graph_attr=(('margin', '3'),))
    for node in json_graph['nodes']:
        params = {
            'name': node['hash'],
            'label': node['display_name'],
            'pos': f"{node['data']['x'] / 55},{-node['data']['y'] / 55}!",
            'shape': 'box',
            'style': 'rounded,filled',
            'color': colormap[node['label']],
            'fontcolor': 'white',
            'fontname': 'sans-serif',
            'fillcolor': colormap[node['label']],
            'margin': "0.2,0.0"
        }
        if 'hyperlink' in node['data'] and node['data']['hyperlink']:
            params['href'] = node['data']['hyperlink']

        graph.node(**params)

    for edge in json_graph['edges']:
        graph.edge(
            edge['from'],
            edge['to'],
            edge['label'],
            color='blue'
        )

    return graph.pipe()
