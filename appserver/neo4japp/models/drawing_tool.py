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
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id'), nullable=False)


class ProjectSchema(ma.ModelSchema):
    class Meta:
        model = Project
