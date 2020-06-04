import enum
from neo4japp.database import db
from neo4japp.models import RDBMSBase
from sqlalchemy.ext.associationproxy import association_proxy


class ProjectsRole(enum.Enum):
    """ Project roles """
    ADMIN = 'admin'
    READ = 'read'
    WRITE = 'write'


class Projects(RDBMSBase):  # type: ignore
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    project_name = db.Column(db.String(250), unique=True, nullable=False)
    description = db.Column(db.Text)
    creation_date = db.Column(db.DateTime, default=db.func.now())
    users = db.Column(db.ARRAY(db.Integer), nullable=False)

    directories = db.relationship('Directory')
    appusers = association_proxy('projects_appusers', 'appuser')


class ProjectsCollaboratorRole(db.Model):  # type: ignore
    __tablename__ = 'projects_collaborator_role'
    appuser_id = db.Column(db.Integer, db.ForeignKey('appuser.id'), primary_key=True)
    projects_id = db.Column(db.Integer, db.ForeignKey('projects.id'), primary_key=True)
    project_role = db.Column(db.String(20), nullable=False)

    appuser = db.relationship('AppUser')
    projects = db.relationship(
        Projects, backref=db.backref('projects_appusers', cascade='all, delete-orphan'))

    def __init__(self, appuser=None, projects=None, project_role=None):
        self.projects = projects
        self.appuser = appuser
        self.project_role = project_role
