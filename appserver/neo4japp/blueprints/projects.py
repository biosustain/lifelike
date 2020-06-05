from flask import request, jsonify, Blueprint, g, abort
from neo4japp.blueprints.auth import auth
from neo4japp.database import db
from neo4japp.exceptions import RecordNotFoundException
from neo4japp.models import Directory, Projects

bp = Blueprint('projects', __name__, url_prefix='/projects')


@bp.route('/<name>', methods=['GET'])
@auth.login_required
def get_project(name):
    # TODO: Add permission checks here
    user = g.current_user
    projects = Projects.query.filter(Projects.project_name == name).one_or_none()
    if projects is None:
        raise RecordNotFoundException(f'Project {name} not found')

    return jsonify(dict(results=projects.to_dict())), 200


@bp.route('/', methods=['GET'])
@auth.login_required
def get_projects():
    # TODO: Add permission checks here
    user = g.current_user
    projects_list = db.session.query(Projects).all()  # TODO: paginate
    return jsonify(dict(results=[p.to_dict() for p in projects_list])), 200


@bp.route('/', methods=['POST'])
@auth.login_required
def add_projects():

    data = request.get_json()
    user = g.current_user

    projects = Projects(
        project_name=data['projectName'],
        description=data['description'],
        users=[user.id],  # TODO: deprecate once migration is complete
    )

    db.session.add(projects)
    db.session.flush()

    # Create a default directory for every project
    default_dir = Directory(name='/', directory_parent_id=None, projects_id=projects.id)

    db.session.add(default_dir)
    db.session.flush()

    db.session.commit()

    return jsonify(dict(results=projects.to_dict())), 200
