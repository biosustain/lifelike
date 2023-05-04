from neo4japp.database import db
from neo4japp.models.common import RDBMSBase


class TransactionTask(RDBMSBase):
    __tablename__ = 'transaction_task'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    detail = db.Column(db.Text, nullable=True)
    transaction_id = db.Column(db.String(64), nullable=False)
