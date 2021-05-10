import sqlalchemy as sa

from neo4japp.database import db
from neo4japp.models.common import RDBMSBase


class OrganismGeneMatch(RDBMSBase):
    """Temporary table used to match genes to organisms.
    """
    id = db.Column(db.Integer, primary_key=True)
    gene_id = db.Column(db.String(128), nullable=False)
    gene_name = db.Column(db.String(128), nullable=False)
    synonym = db.Column(db.String(128), nullable=False)
    taxonomy_id = db.Column(db.String(128), nullable=False)
    organism = db.Column(db.String(128), nullable=False)
