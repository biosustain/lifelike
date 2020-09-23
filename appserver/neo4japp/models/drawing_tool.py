import hashlib

from datetime import datetime

from sqlalchemy import event
from sqlalchemy_utils.types import TSVectorType
from sqlalchemy.types import TIMESTAMP

from neo4japp.constants import FILE_INDEX_ID, TIMEZONE
from neo4japp.database import (
    db,
    get_elastic_service,
    ma
)
from neo4japp.models.common import ModelConverter, RDBMSBase, TimestampMixin


class Project(RDBMSBase, TimestampMixin):
    """ Model representation of a project drawing in a
        network graph networking tool
    """
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(250), nullable=False)
    description = db.Column(db.Text)
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


# # Project table ORM event listeners
@event.listens_for(Project, 'after_insert')
def project_after_insert(mapper, connection, target):
    """listen for the 'after_insert' event"""

    # We typically don't *insert* maps with the hash_id, we add them without it and then add
    # the hash id later. Because of this, we *cannot* add the map as an elastic document because we
    # won't be able to find it later.
    if target.hash_id is not None:
        # Add this map as an elasticsearch document
        elastic_service = get_elastic_service()
        elastic_service.index_maps([target.id])


@event.listens_for(Project, 'after_delete')
def project_after_delete(mapper, connection, target):
    """listen for the 'after_delete' event"""

    # Delete this map from elastic
    elastic_service = get_elastic_service()
    elastic_service.delete_documents_with_index(
        file_ids=[target.hash_id],
        index_id=FILE_INDEX_ID
    )


@event.listens_for(Project, 'after_update')
def project_after_update(mapper, connection, target):
    """listen for the 'after_update' event"""

    # Delete the old version of the map from our elastic documents, then reindex
    elastic_service = get_elastic_service()
    # This will throw an error if we have just created the map. We catch and log it, and it
    # is expected. The reason for this is that when we create a map, we don't give it a hash_id,
    # but we normally use the hash_id as the identifier in elastic. So, instead we choose *not*
    # to immediately add it to elastic and instead add it here. But, because it's not *in*
    # elastic, when we go to delete it, elastic complains because it doesn't exist.
    elastic_service.delete_documents_with_index(
        file_ids=[target.hash_id],
        index_id=FILE_INDEX_ID
    )
    elastic_service.index_maps([target.id])


class ProjectVersion(RDBMSBase, TimestampMixin):
    """ Model representation of a version of a project drawing in a
        network graph networking tool
    """
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(250), nullable=False)
    description = db.Column(db.Text)
    graph = db.Column(db.JSON)
    public = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, db.ForeignKey('appuser.id'), nullable=False)
    dir_id = db.Column(db.Integer, db.ForeignKey('directory.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    search_vector = db.Column(TSVectorType('label'))


class ProjectBackup(RDBMSBase, TimestampMixin):
    """ Backup version of Project """
    project_id = db.Column(db.Integer, primary_key=True, nullable=False)
    label = db.Column(db.String(250), nullable=False)
    description = db.Column(db.Text)
    graph = db.Column(db.JSON)
    author = db.Column(db.String(240), nullable=False)
    public = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, nullable=False)
    hash_id = db.Column(db.String(50))
