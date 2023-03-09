from numbers import Number

from flask.json import JSONEncoder
from sqlalchemy.sql.sqltypes import TIMESTAMP

from neo4japp.models import GraphNode, GraphRelationship


class CustomJSONEncoder(JSONEncoder):
    def default(self, obj):
        try:
            if isinstance(obj, (GraphNode, GraphRelationship)):
                return obj.to_dict()
            elif isinstance(obj, (TIMESTAMP, Number)):
                return str(obj)
        except TypeError:
            pass
        return JSONEncoder.default(self, obj)
