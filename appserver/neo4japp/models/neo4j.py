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

    def property_filter(self, properties, only=None, include=None, exclude=None, keyfn=None):
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
    def from_neo4j(
        cls,
        node: N4jDriverNode,
        prop_filter_fn=None,
        primary_label_fn=None,
        domain_labels_fn=None,
        display_fn=None,
        url_fn=None
    ):
        labels = [label for label in node.labels]
        prop_filter_fn = prop_filter_fn or (lambda x: x)
        primary_label = labels[0] if not primary_label_fn else primary_label_fn(node)
        domain_labels = [] if not domain_labels_fn else domain_labels_fn(node)
        data = prop_filter_fn({k: v for k, v in dict(node).items()})
        data = snake_to_camel_dict(data, {})
        display_name = None if not display_fn else display_fn(node)
        url = None if not url_fn else url_fn(node)
        return cls(node.id, primary_label, domain_labels, data, labels, display_name, url)


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
    def from_neo4j(cls, rel: N4jDriverRelationship):
        return cls(
            id=rel.id,
            label=type(rel).__name__,
            data=dict(rel),
            to=rel.end_node.id,
            _from=rel.start_node.id,
            to_label=list(rel.end_node.labels)[0],
            from_label=list(rel.start_node.labels)[0]
        )
