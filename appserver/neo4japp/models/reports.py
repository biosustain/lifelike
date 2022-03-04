from neo4japp.database import db
from .common import RDBMSBase, TimestampMixin


class CopyrightInfringementRequest(RDBMSBase, TimestampMixin):
    """
        User models to tie ownership of resources to
    """
    __tablename__ = 'copyright_infringement_request'

    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(256), nullable=False)
    description = db.Column(db.String(1000), nullable=False)
    name = db.Column(db.String(256), nullable=False)
    company = db.Column(db.String(256), nullable=False)
    address = db.Column(db.String(256), nullable=False)
    country = db.Column(db.String(256), nullable=False)
    city = db.Column(db.String(256), nullable=False)
    province = db.Column(db.String(256), nullable=False)
    zip = db.Column(db.String(256), nullable=False)
    phone = db.Column(db.String(256), nullable=False)
    fax = db.Column(db.String(256), nullable=True)
    email = db.Column(db.String(256), nullable=False)
    attestationCheck1 = db.Column(db.Boolean(), nullable=False)
    attestationCheck2 = db.Column(db.Boolean(), nullable=False)
    attestationCheck3 = db.Column(db.Boolean(), nullable=False)
    attestationCheck4 = db.Column(db.Boolean(), nullable=False)
    signature = db.Column(db.String(256), nullable=False)
