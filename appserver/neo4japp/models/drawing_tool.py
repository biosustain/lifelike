from neo4japp.database import db, ma
from neo4japp.models import RDBMSBase


class Project(RDBMSBase):
    """ Model representation of a project drawing in a
        network graph networking tool
    """
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(250), nullable=False)
    description = db.Column(db.Text)
    date_modified = db.Column(db.DateTime)
    graph = db.Column(db.JSON)
    author = db.Column(db.String(240), nullable=False)
    public = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id'), nullable=False)
    hash_id = db.Column(db.String(50), unique=True)


class ProjectSchema(ma.ModelSchema):  # type: ignore
    class Meta:
        model = Project
