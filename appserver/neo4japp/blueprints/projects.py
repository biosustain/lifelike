from flask import request, jsonify, Blueprint, g, abort
from neo4japp.blueprints.auth import auth
from neo4japp.database import db
from neo4japp.models.projects import Projects

bp = Blueprint('projects', __name__, url_prefix='/projects')


@bp.route('/list', methods=['GET'])
@auth.login_required
def get_projects():
    user = g.current_user
    projects = [{
        'id': row.id,
        'project_name': row.project_name,
        'description': row.description,
        'creation_date': row.creation_date
    } for row in db.session.query(
        Projects.id,
        Projects.project_name,
        Projects.description,
        Projects.creation_date)
        .filter(Projects.users.any(user.id))
        .all()]
    return jsonify({'projects': projects})


@bp.route('/add', methods=['POST'])
@auth.login_required
def add_projects():
    try:
        data = request.get_json()
        user = g.current_user

        project = Projects(
            project_name=data.get("project_name", ""),
            description=data.get("description", ""),
            users=[user.id]
        )

        db.session.add(project)
        db.session.commit()

        return {
            'status': 'success',
            'project': project.id,
            'name': project.project_name,
            'description': project.description,
            'users': project.users
        }
    except Exception:
        abort(400, 'Project was not added.')
