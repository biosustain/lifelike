from neo4japp.database import db
from neo4japp.models.common import RDBMSBase


class AnnotationStopWords(RDBMSBase):
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    word = db.Column(db.String(200), nullable=False)
