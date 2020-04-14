from flask.json import JSONEncoder

from neo4japp.models import GraphNode, GraphRelationship


class CustomJSONEncoder(JSONEncoder):
    def default(self, obj):
        try:
            if isinstance(obj, GraphNode):
                return obj.to_dict()
            elif isinstance(obj, GraphRelationship):
                return obj.to_dict()
        except TypeError:
            pass
        return JSONEncoder.default(self, obj)
