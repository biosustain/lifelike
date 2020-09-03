import hashlib

from datetime import datetime

from sqlalchemy_utils.types import TSVectorType
from sqlalchemy.types import TIMESTAMP

from neo4japp.constants import TIMEZONE
from neo4japp.database import db, ma
from neo4japp.models.common import ModelConverter, RDBMSBase


class Project(RDBMSBase):
    """ Model representation of a project drawing in a
        network graph networking tool
    """
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(250), nullable=False)
    description = db.Column(db.Text)
    creation_date = db.Column(TIMESTAMP(timezone=True), default=db.func.now(), nullable=False)
    date_modified = db.Column(TIMESTAMP(timezone=True), nullable=False)
    graph = db.Column(db.JSON)
    author = db.Column(db.String(240), nullable=False)
    public = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id'), index=True, nullable=False)
    user = db.relationship('AppUser', foreign_keys=user_id)
    dir_id = db.Column(db.Integer, db.ForeignKey('directory.id'), index=True, nullable=False)
    dir = db.relationship('Directory', foreign_keys=dir_id)
    hash_id = db.Column(db.String(50), unique=True)
    versions = db.relationship('ProjectVersion', backref='project', lazy=True)
    search_vector = db.Column(TSVectorType('label'), index=True)

    def set_hash_id(self):
        """ Assign hash based on project id with salt
        """
        salt = "i am man"

        h = hashlib.md5(
            "{} {}".format(self.id, salt).encode()
        )
        self.hash_id = h.hexdigest()


class ProjectVersion(RDBMSBase):
    """ Model representation of a version of a project drawing in a
        network graph networking tool
    """
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(250), nullable=False)
    description = db.Column(db.Text)
    date_modified = db.Column(db.DateTime, onupdate=datetime.now(TIMEZONE))
    graph = db.Column(db.JSON)
    public = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id'), nullable=False)
    dir_id = db.Column(db.Integer, db.ForeignKey('directory.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    search_vector = db.Column(TSVectorType('label'))
    creation_date = db.Column(db.DateTime, default=datetime.now(TIMEZONE))


class ProjectBackup(RDBMSBase):
    """ Backup version of Project """
    project_id = db.Column(db.Integer, primary_key=True, nullable=False)
    label = db.Column(db.String(250), nullable=False)
    description = db.Column(db.Text)
    creation_date = db.Column(TIMESTAMP(timezone=True), default=db.func.now(), nullable=False)
    date_modified = db.Column(TIMESTAMP(timezone=True), nullable=False)
    graph = db.Column(db.JSON)
    author = db.Column(db.String(240), nullable=False)
    public = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, nullable=False)
    hash_id = db.Column(db.String(50))
