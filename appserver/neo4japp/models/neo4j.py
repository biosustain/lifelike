from flask import json
from py2neo import Node, Relationship
from neo4japp.models.common import NEO4JBase
from neo4japp.util import snake_to_camel_dict


class GraphNode(NEO4JBase):
    def __init__(self, id, label, data, sub_labels, display_name):
        self.id = id
        self.label = label
        self.data = data
        self.sub_labels = sub_labels
        self.display_name = display_name

    @staticmethod
    def property_filter(properties, only=None, include=None, exclude=None, keyfn=None):
        if only:
            attrs = only
        else:
            exclude = exclude or []
            attrs = (include or []) + [k for k in properties.keys() if k not in exclude]

        keyfn = keyfn or (lambda x: x)
        retval = {}
        for k in attrs:
            key = keyfn(k)
            retval[key] = properties[k]
        return retval

    @classmethod
    def from_py2neo(cls, node: Node, prop_filter_fn=None, primary_label_fn=None, display_fn=None):
        labels = [l for l in node.labels]
        prop_filter_fn = prop_filter_fn or (lambda x: x)
        primary_label = labels[0] if not primary_label_fn else primary_label_fn(node)
        data = prop_filter_fn({k: v for k, v in dict(node).items()})
        data = snake_to_camel_dict(data, {})
        display_name = None if not display_fn else display_fn(node)
        return cls(node.identity, primary_label, data, labels, display_name)


class GraphRelationship(NEO4JBase):
    def __init__(self, id, label, data, to, _from, to_label, from_label):
        self.id = id
        self.label = label
        self.data = data
        self.to = to
        self._from = _from
        self.to_label = to_label
        self.from_label = from_label

    @classmethod
    def from_dict(cls, d):
        copy = d.copy()
        copy['_from'] = copy['from']
        del copy['from']
        return super().from_dict(copy)

    def to_dict(self):
        copy = super().to_dict().copy()
        copy['from'] = copy['From']
        del copy['From']
        return copy

    @classmethod
    def from_py2neo(cls, rel: Relationship):
        return cls(
            id=rel.identity,
            label=type(rel).__name__,
            data=dict(rel),
            to=rel.end_node.identity,
            _from=rel.start_node.identity,
            to_label=list(rel.end_node.labels)[0],
            from_label=list(rel.start_node.labels)[0]
        )
