from neo4japp.database import db
from neo4japp.models.common import RDBMSBase


class DomainULRsMap(RDBMSBase):
    """
    This model stores the relation between knowledge domains and its base URLs
    """
    id = db.Column(db.Integer, primary_key=True)
    domain = db.Column(db.String(128), nullable=False)
    base_URL = db.Column(db.String(256), nullable=False)
