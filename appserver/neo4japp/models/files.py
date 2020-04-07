from neo4japp.database import db
from sqlalchemy.dialects.postgresql import BYTEA


class Files(db.Model):
    __tablename__ = 'files'
    id = db.Column(db.String(), primary_key=True)
    filename = db.Column(db.String(60), unique=True)
    file = db.Column(BYTEA())
    username = db.Column(db.String(30))
    creation_date = db.Column(db.DateTime())

    def __init__(self, id, filename, file, username, creation_date):
        self.id = id
        self.filename = filename
        self.file = file
        self.username = username
        self.creation_date = creation_date
