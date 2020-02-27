from datetime import datetime, timedelta
from flask import current_app, request, Response, json, Blueprint
import jwt

from neo4japp.database import db
from neo4japp.models.drawing_tool import AppUser, Project, ProjectSchema
from neo4japp.util import auth, pullUserFromAuthHead

bp = Blueprint('drawing_tool', __name__)


@bp.route('/projects', methods=['GET'])
@auth.login_required
def get_project():
    """

    """
    user = pullUserFromAuthHead()

    # Pull the projects tied to that user
    projects = Project.query.filter_by(user_id=user.id).all()
    project_schema = ProjectSchema(many=True)

    return {'projects': project_schema.dump(projects)}, 200


@bp.route('/projects', methods=['POST'])
@auth.login_required
def add_project():
    """

    """
    data = request.get_json()
    user = pullUserFromAuthHead()

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

    """
    user = pullUserFromAuthHead()
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
    user = pullUserFromAuthHead()

    # Pull up project by id
    project = Project.query.filter_by(
        id=project_id,
        user_id=user.id
    ).first_or_404()

    # Commit to db
    db.session.delete(project)
    db.session.commit()

    return {'status': 'success'}, 200