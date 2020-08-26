import hashlib

from sqlalchemy_utils.types import TSVectorType

from neo4japp.database import db
from neo4japp.models.common import RDBMSBase


class Project(RDBMSBase):
    """ Model representation of a project drawing in a
        network graph networking tool
    """
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(250), nullable=False)
    description = db.Column(db.Text)
    creation_date = db.Column(db.DateTime, default=db.func.now())
    date_modified = db.Column(db.DateTime)
    graph = db.Column(db.JSON)
    author = db.Column(db.String(240), nullable=False)
    public = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id'), index=True, nullable=False)
    user = db.relationship('AppUser', foreign_keys=user_id)
    dir_id = db.Column(db.Integer, db.ForeignKey('directory.id'), index=True, nullable=False)
    dir = db.relationship('Directory', foreign_keys=dir_id)
    hash_id = db.Column(db.String(50), unique=True)
    search_vector = db.Column(TSVectorType('label'), index=True)

    def set_hash_id(self):
        """ Assign hash based on project id with salt
        """
        salt = "i am man"

        h = hashlib.md5(
            "{} {}".format(self.id, salt).encode()
        )
        self.hash_id = h.hexdigest()


class ProjectBackup(RDBMSBase):
    """ Backup version of Project """
    project_id = db.Column(db.Integer, primary_key=True, nullable=False)
    label = db.Column(db.String(250), nullable=False)
    description = db.Column(db.Text)
    creation_date = db.Column(db.DateTime, default=db.func.now())
    date_modified = db.Column(db.DateTime)
    graph = db.Column(db.JSON)
    author = db.Column(db.String(240), nullable=False)
    public = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, nullable=False)
    hash_id = db.Column(db.String(50))
