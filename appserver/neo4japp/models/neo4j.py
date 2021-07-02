from neo4j.graph import Node as N4jDriverNode, Relationship as N4jDriverRelationship

from neo4japp.models.common import NEO4JBase
from neo4japp.util import snake_to_camel_dict


class GraphNode(NEO4JBase):
    def __init__(self, id, label, domain_labels, data, sub_labels, display_name, url):
        self.id = id
        self.label = label
        self.domain_labels = domain_labels
        self.data = data
        self.sub_labels = sub_labels
        self.display_name = display_name
        self.entity_url = url


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
