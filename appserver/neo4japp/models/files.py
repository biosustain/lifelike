from sqlalchemy.dialects import postgresql
from neo4japp.database import db



class Files(db.Model):  # type: ignore
    __tablename__ = 'files'
    id = db.Column(db.Integer(), primary_key=True, autoincrement=True)
    file_id = db.Column(db.String(36), unique=True, nullable=False)
    # TODO: unique file name could be problematic
    # add a setter to increment name before inserting
    filename = db.Column(db.String(60), nullable=False)
    raw_file = db.Column(db.LargeBinary, nullable=False)
    username = db.Column(db.String(30))
    creation_date = db.Column(db.DateTime, default=db.func.now())
    annotations = db.Column(postgresql.JSONB, nullable=False, server_default='[]')
