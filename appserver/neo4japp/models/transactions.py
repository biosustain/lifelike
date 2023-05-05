from sqlalchemy.dialects import postgresql

from neo4japp.database import db
from neo4japp.models.common import RDBMSBase


class TransactionTask(RDBMSBase):
    __tablename__ = 'transaction_task'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    detail = db.Column(postgresql.JSONB, nullable=True, server_default='[]')
    transaction_id = db.Column(db.String(64), nullable=False)
