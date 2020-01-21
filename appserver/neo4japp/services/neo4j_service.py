import attr

from typing import Dict, List

from werkzeug.datastructures import FileStorage

from neo4japp.factory import cache
from neo4japp.models import GraphNode, GraphRelationship
from neo4japp.util import CamelDictMixin, compute_hash
from neo4japp.services.common import BaseDao

from openpyxl import load_workbook
from openpyxl import Workbook
from openpyxl.worksheet.worksheet import Worksheet
from py2neo import (
    Graph,
    Node,
    Transaction,
    NodeMatch,
    Relationship,
    RelationshipMatch,
    RelationshipMatcher,
)


@attr.s(frozen=True)
class FileNameAndSheets(CamelDictMixin):
    @attr.s(frozen=True)
    class SheetNameAndColumnNames(CamelDictMixin):
        sheet_name: str = attr.ib()
        # key is column name, value is column index
        sheet_column_names: List[Dict[str, int]] = attr.ib()

    sheets: List[SheetNameAndColumnNames] = attr.ib()
    filename: str = attr.ib()


@attr.s(frozen=True)
class Neo4jColumnMapping(CamelDictMixin):
    """The int values are the column index
    from the excel files."""
    @attr.s(frozen=True)
    class Neo4jNodeMapping(CamelDictMixin):
        node_label: Dict[int, str] = attr.ib()
        node_properties: Dict[int, str] = attr.ib()

    # @attr.s(frozen=True)
    # class Neo4jEdgeMapping(CamelDictMixin):
    #     node_label: Dict[int, str] = attr.ib()
    #     node_properties: Dict[int, str] = attr.ib()

    source_node: Neo4jNodeMapping = attr.ib()
    target_node: Neo4jNodeMapping = attr.ib()
    edge: int = attr.ib()
    file_name: str = attr.ib()
    sheet_name: str = attr.ib()


class Neo4JService(BaseDao):
    def __init__(self, graph):
        super().__init__(graph)

    def execute_cypher(self, query):
        # TODO: Sanitize the queries
        records = self.graph.run(query).data()
        if not records:
            return None
        node_dict = dict()
        rel_dict = dict()
        for record in records:
            graph_node = GraphNode.from_py2neo(record['node'])
            node_dict[graph_node.id] = graph_node
            graph_rel = GraphRelationship.from_py2neo(record['relationship'])
            rel_dict[graph_rel.id] = graph_rel
        return dict(nodes=[n.to_dict() for n in node_dict.values()],
                    edges=[r.to_dict() for r in rel_dict.values()])

    def parse_file(self, f: FileStorage) -> Workbook:
        workbook = load_workbook(f)
        print(f.filename)
        cache.set(f.filename, workbook)
        return workbook

    def get_workbook_sheet_names_and_columns(
        self,
        filename: str,
        workbook: Workbook,
    ) -> FileNameAndSheets:
        sheet_list = []
        for i in range(0, len(workbook.sheetnames)):
            workbook.active = i
            current_ws: Worksheet = workbook.active

            sheet_col_names = []
            # loop through just the first row
            for i, cols in enumerate(current_ws.iter_cols(
                max_row=1,
                max_col=len(list(current_ws.columns)) - 1,
                values_only=True,
            )):
                if cols[0]:
                    sheet_col_names.append({cols[0]: i})

            sheet_list.append(FileNameAndSheets.SheetNameAndColumnNames(
                sheet_name=current_ws.title,
                sheet_column_names=sheet_col_names,
            ))
        sheets = FileNameAndSheets(sheets=sheet_list, filename=filename)
        return sheets

    def create_neo4j_json_mapping(
        self,
        column_mappings: Neo4jColumnMapping,
    ) -> dict:
        nodes = []
        edges = []

        source_col_idx_node_label = {}
        source_col_idx_node_prop = {}
        target_col_idx_node_label = {}
        target_col_idx_node_prop = {}

        # TODO: why is the key changing to str?
        for k, v in column_mappings.source_node.node_label.items():
            source_col_idx_node_label[int(k)] = v

        for k, v in column_mappings.source_node.node_properties.items():
            source_col_idx_node_prop[int(k)] = v

        for k, v in column_mappings.target_node.node_label.items():
            target_col_idx_node_label[int(k)] = v

        for k, v in column_mappings.target_node.node_properties.items():
            target_col_idx_node_prop[int(k)] = v

        workbook = cache.get(column_mappings.file_name)

        for i, name in enumerate(workbook.sheetnames):
            if name == column_mappings.sheet_name:
                workbook.active = i
                break

        current_ws = workbook.active

        for row in current_ws.iter_rows(
            min_row=2,
            max_row=len(list(current_ws.rows)) - 1,
            max_col=len(list(current_ws.columns)) - 1,
            values_only=True,
        ):
            src_node = {}  # type: ignore
            src_node_props = {}
            src_node_label = list(source_col_idx_node_label.values())[0]

            # source node
            for k, v in source_col_idx_node_prop.items():
                src_node_props[v] = row[k]

            src_node['data'] = src_node_props
            src_node['label'] = src_node_label  # type: ignore
            src_node['hash'] = compute_hash(src_node)  # type: ignore
            nodes.append(src_node)

            if len(target_col_idx_node_label) > 0:
                tgt_node = {}  # type: ignore
                tgt_node_props = {}
                tgt_node_label = list(target_col_idx_node_label.values())[0]

                # target node
                for k, v in target_col_idx_node_prop.items():
                    tgt_node_props[v] = row[k]

                tgt_node['data'] = tgt_node_props
                tgt_node['label'] = tgt_node_label  # type: ignore
                tgt_node['hash'] = compute_hash(tgt_node)  # type: ignore
                nodes.append(tgt_node)

                # edge
                edge = {}  # type: ignore
                edge['data'] = {}
                edge['src'] = src_node['hash']
                edge['dest'] = tgt_node['hash']
                edge['label'] = row[column_mappings.edge]
                edges.append(edge)
        return {'edges': edges, 'nodes': nodes}

    def search_for_relationship_with_label_and_properties(
        self,
        label: str,
        props: dict,
        src: Node,
        dest: Node,
    ) -> RelationshipMatch:
        if label is None or not label:
            raise Exception(
                'No label provided for search query! Is the JSON object malformed?\n' +
                'Props:\n' +
                ''.join([f'\t{key}: {value}\n' for key, value in props.items()])
            )
        rm = RelationshipMatcher(self.graph)
        return rm.match([src, dest], label, **props).first()

    def goc_relationship_from_data(
        self,
        node_hash_map: dict,
        rel_data: dict,
        tx: Transaction,
    ) -> Relationship:
        label = rel_data['label']
        src_node = node_hash_map[rel_data['src']]
        dest_node = node_hash_map[rel_data['dest']]
        props = rel_data['data']

        existing_relationship = self.search_for_relationship_with_label_and_properties(
            label, props, src_node, dest_node)

        if existing_relationship:
            return existing_relationship
        else:
            new_relationship = Relationship(src_node, label, dest_node, **props)
            tx.create(new_relationship)
            return new_relationship

    def search_for_node_with_label_and_properties(
        self,
        label: str,
        props: dict,
    ) -> NodeMatch:
        if label is None or not label:
            raise Exception(
                'No label provided for search query! Is the JSON object malformed?\n' +
                'Props:\n' +
                ''.join([f'\t{key}: {value}\n' for key, value in props.items()])
            )
        return self.graph.nodes.match(label, **props).first()

    def goc_node_from_data(
        self,
        node_data: dict,
        tx: Transaction,
    ) -> Node:
        label = node_data['label']
        props = node_data['data']

        existing_node = self.search_for_node_with_label_and_properties(label, props)

        if existing_node:
            return existing_node
        else:
            new_node = Node(label, **props)
            tx.create(new_node)
            return new_node

    def export_to_neo4j(self, column_mappings: Neo4jColumnMapping) -> None:
        print(column_mappings)
        neo4j_mapping = self.create_neo4j_json_mapping(column_mappings)

        tx = self.graph.begin()
        # bar = Bar('Creating nodes...', max=len(neo4j_mapping['nodes']))
        node_hash_map = dict()

        for node in neo4j_mapping['nodes']:
            n = self.goc_node_from_data(node, tx)
            node_hash_map[node['hash']] = n
        #     bar.next()
        # bar.finish()

        # bar = Bar('Creating edges...', max=len(neo4j_mapping['edges']))
        for edge in neo4j_mapping['edges']:
            _ = self.goc_relationship_from_data(node_hash_map, edge, tx)
        #     bar.next()
        # bar.finish()

        tx.commit()
        print('Done')
