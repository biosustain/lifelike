from neo4japp.database import db
from neo4japp.models.common import RDBMSBase


project_role = db.Table(
    'project_user_role',
    db.Column(
        'appuser_id',
        db.Integer,
        db.ForeignKey('appuser.id', ondelete='CASCADE'),
        primary_key=True,
    ),
    db.Column(
        'app_role_id',
        db.Integer,
        db.ForeignKey('app_role.id', ondelete='CASCADE'),
        primary_key=True,
    ),
    db.Column(
        'project_id',
        db.Integer,
        db.ForeignKey('project.id', ondelete='CASCADE'),
        primary_key=True,
    )
)


class Projects(RDBMSBase):  # type: ignore
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    project_name = db.Column(db.String(250), unique=True, nullable=False)
    description = db.Column(db.Text)
    creation_date = db.Column(db.DateTime, default=db.func.now())
    users = db.Column(db.ARRAY(db.Integer), nullable=False)

    directories = db.relationship('Directory')
