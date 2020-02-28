import attr
from neo4japp.constants import *
from neo4japp.models import GraphNode, GraphRelationship
from neo4japp.util import CamelDictMixin

from typing import List, Optional

@attr.s
class SearchResult(CamelDictMixin):
    id: str = attr.ib(default='')
    score: float = attr.ib(default=0.0)
    type: str = attr.ib(default='')
    labels: [str] = attr.ib(default=[])
    data_source: str = attr.ib(default='')
    all_text: str = attr.ib(default='')
    common_name: str = attr.ib(default='')
    synonyms: str = attr.ib(default='')
    alt_ids: [str] = attr.ib(default=[])
    conjugate: str = attr.ib(default='')
    organism: object = attr.ib(default=None)  # TODO: Make more specific

    def get_db_labels(self):
        return [l for l in self.labels
                if l not in set(TYPE_COMPOUND, TYPE_GENE, TYPE_PROTEIN, TYPE_PATHWAY)]

    def is_gene(self):
        return TYPE_GENE == self.type or TYPE_GENE in self.labels

    def is_protein(self):
        return TYPE_PROTEIN == self.type or TYPE_PROTEIN in self.labels

    def is_compound(self):
        return TYPE_COMPOUND == self.type or TYPE_COMPOUND in self.labels

    def is_chemical(self):
        return TYPE_CHEMICAL == self.type or DB_CHEBI in self.labels

    def is_pathway(self):
        return TYPE_PATHWAY == self.type or TYPE_PATHWAY in self.labels

    def node_label(self):
        return ':' + ':'.join(self.labels)

    def get_node_label(self, node_type: str, db_names: [str]):
        labels = []
        if node_type == TYPE_CHEMICAL:
            labels = labels + db_names
        else:
            labels.append(node_type)
            labels += db_names
        return ':'.join(labels)

    def get_graph_layout(self):
        if self.is_compound():
            # TODO: See what the equivalent is
            # for vis.js
            # {'layout': 'klay', 'rank_dir': 'TB'}
            pass
        else:
            # TODO: See what the equivalent is
            # for vis.js
            # {'layout': 'dagre', 'rank_dir': 'TB'}
            pass


@attr.s
class GraphRequest(SearchResult):
    org_ids: str = attr.ib(default='')

# TODO: Move this into a DTO!
@attr.s(frozen=True)
class VisNode(CamelDictMixin):
    id: int = attr.ib()
    label: str = attr.ib()
    data: dict = attr.ib()
    sub_labels: List[str] = attr.ib()
    display_name: str = attr.ib()
    primary_label: str = attr.ib()
    color: dict = attr.ib()
    expanded: bool = attr.ib()

# TODO: Move this into a DTO!
@attr.s(frozen=True)
class DuplicateVisNode(VisNode):
    id: str = attr.ib()
    duplicate_of: int = attr.ib()

# TODO: Move this into a DTO!
@attr.s(frozen=True)
class VisEdge(CamelDictMixin):
    id: int = attr.ib()
    label: str = attr.ib()
    data: dict = attr.ib()
    to: int = attr.ib()
    from_: int = attr.ib()
    arrows: Optional[str] = attr.ib()

    @classmethod
    def build_from_dict(cls, d):
        copy = d.copy()
        copy['from_'] = copy['from']
        del copy['from']
        return super().build_from_dict(copy)

    def to_dict(self):
        copy = self.__dict__.copy()
        copy['from'] = copy['from_']
        del copy['from_']
        return copy

# TODO: Move this into a DTO!
@attr.s(frozen=True)
class DuplicateVisEdge(VisEdge):
    id: str = attr.ib()
    duplicate_of: int = attr.ib()
    original_from: int = attr.ib()
    original_to: int = attr.ib()

# TODO: Move this into a DTO!
@attr.s(frozen=True)
class NodeEdgePair(CamelDictMixin):
    node: GraphNode = attr.ib()
    edge: GraphRelationship = attr.ib()

# TODO: Move this into a DTO!
@attr.s(frozen=True)
class DuplicateNodeEdgePair(CamelDictMixin):
    node: DuplicateVisNode = attr.ib()
    edge: DuplicateVisEdge = attr.ib()

# TODO: Add this to DTO file
@attr.s(frozen=True)
class ClusteredNode(CamelDictMixin):
    node_id: int = attr.ib()
    edges: List[DuplicateVisEdge] = attr.ib()