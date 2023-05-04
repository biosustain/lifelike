from flask import Blueprint, jsonify
from flask.views import MethodView
from sqlalchemy import func

from neo4japp.database import db
from neo4japp.models.transactions import TransactionTask



bp = Blueprint('transactions', __name__, url_prefix='/transactions')


class TransactionTasksCount(MethodView):
    """
    API for tracking remaining transaction task count.
    """

    def get(self, txn_id):
        txn_task_count = db.session.query(
            func.count(TransactionTask.id)
        ).filter(
            TransactionTask.transaction_id == txn_id
        ).scalar()
        return jsonify(total=txn_task_count)



bp.add_url_rule('list/<string:txn_id>', view_func=TransactionTasksCount.as_view('txn_tasks_list'))
