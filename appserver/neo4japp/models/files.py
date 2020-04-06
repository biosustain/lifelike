from neo4japp.database import db
from sqlalchemy.dialects import postgresql

class Files(db.Model):
    __tablename__ = 'files'
    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    file_id = db.Column(db.String(36), unique=True, nullable=False)
    # TODO: unique file name could be problematic
    # add a setter to increment name before inserting
    filename = db.Column(db.String(60), unique=True, nullable=False)
    raw_file = db.Column(postgresql.BYTEA(), nullable=False)
    username = db.Column(db.String(30))
    creation_date = db.Column(db.DateTime, default=db.func.now())
    annotations = db.Column(postgresql.JSONB, nullable=False, server_default='[]')

    def __init__(self, file_id, filename, raw_file, username, annotations):
        self.file_id = file_id
        self.filename = filename
        self.raw_file = raw_file
        self.username = username
        self.annotations = annotations
