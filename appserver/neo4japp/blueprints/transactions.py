from flask import Blueprint, jsonify
from flask.views import MethodView

from neo4japp.database import db
from neo4japp.exceptions import RecordNotFound
from neo4japp.models.transactions import TransactionTask



bp = Blueprint('transactions', __name__, url_prefix='/transactions')


class GetTransactionTask(MethodView):
    """
    API for tracking remaining transaction task count.
    """

    def get(self, txn_id):
        txn_task = db.session.query(
            TransactionTask
        ).filter(
            TransactionTask.transaction_id == txn_id
        ).one_or_none()

        if txn_task is None:
            raise RecordNotFound(
                title='No transaction with the specified ID found.',
                code=404
            )

        return jsonify(
            id=txn_task.id,
            taxId=txn_task.transaction_id,
            detail=txn_task.detail
        )



bp.add_url_rule('<string:txn_id>', view_func=GetTransactionTask.as_view('get_txn_task'))
