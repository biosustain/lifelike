import hashlib

from neo4japp.database import db, ma
from neo4japp.models.common import RDBMSBase, ModelConverter
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy_searchable import make_searchable
from sqlalchemy_utils.types import TSVectorType

Base = declarative_base()
make_searchable(Base.metadata)


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
    dir_id = db.Column(db.Integer, db.ForeignKey('directory.id'), nullable=False)
    hash_id = db.Column(db.String(50), unique=True)
    search_vector = db.Column(TSVectorType('label'))
    creation_date = db.Column(db.DateTime)

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
    date_modified = db.Column(db.DateTime)
    graph = db.Column(db.JSON)
    author = db.Column(db.String(240), nullable=False)
    public = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id'), nullable=False)
    dir_id = db.Column(db.Integer, db.ForeignKey('directory.id'), nullable=False)
    hash_id = db.Column(db.String(50), unique=True)
    search_vector = db.Column(TSVectorType('label'))
    creation_date = db.Column(db.DateTime)
    version_name = db.Column(db.String(250))
    version_hash_id = db.Column(db.String(50), unique=True)

    def set_version_hash_id(self):
        """ Assign hash based on project id with salt
        """
        salt = "i am man"

        h = hashlib.md5(
            "{} {}".format(self.id, salt).encode()
        )
        self.version_hash_id = h.hexdigest()


class ProjectSchema(ma.ModelSchema):  # type: ignore
    class Meta:
        include_fk = True
        model = Project
        model_converter = ModelConverter


class ProjectBackup(RDBMSBase):
    """ Backup version of Project """
    project_id = db.Column(db.Integer, primary_key=True, nullable=False)
    label = db.Column(db.String(250), nullable=False)
    description = db.Column(db.Text)
    date_modified = db.Column(db.DateTime)
    graph = db.Column(db.JSON)
    author = db.Column(db.String(240), nullable=False)
    public = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, nullable=False)
    hash_id = db.Column(db.String(50))
