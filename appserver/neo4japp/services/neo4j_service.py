from typing import Dict, List

import attr

from py2neo import NodeMatcher, RelationshipMatcher
from werkzeug.datastructures import FileStorage

from neo4japp.services.common import BaseDao
from neo4japp.models import GraphNode, GraphRelationship
from neo4japp.constants import *
from neo4japp.factory import cache
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

    def _query_neo4j(self, query: str):
        # TODO: Can possibly use a dispatch method/injection
        # of sorts to use custom labeling methods for
        # different type of nodes/edges being converted.
        # The default does not always set an appropriate label
        # name.
        records = self.graph.run(query).data()
        if not records:
            return None
        node_dict = dict()
        rel_dict = dict()
        for record in records:
            nodes = record['nodes']
            rels = record['relationships']
            for node in nodes:
                graph_node = GraphNode.from_py2neo(
                    node,
                    display_fn=lambda x: x.get(DISPLAY_NAME_MAP[next(iter(node.labels), set())])
                )
                node_dict[graph_node.id] = graph_node
            for rel in rels:
                graph_rel = GraphRelationship.from_py2neo(rel)
                rel_dict[graph_rel.id] = graph_rel
        return dict(nodes=[n.to_dict() for n in node_dict.values()],
                    edges=[r.to_dict() for r in rel_dict.values()])

    def get_organisms(self):
        nodes = list(NodeMatcher(self.graph).match(NODE_SPECIES))
        organism_nodes = [
            GraphNode.from_py2neo(n, display_fn=lambda x: x.get('common_name'))
                for n in nodes
        ]
        return dict(nodes=[n.to_dict() for n in organism_nodes], edges=[])

    def get_some_diseases(self):
        nodes = list(NodeMatcher(self.graph).match(TYPE_DISEASE).limit(10))
        disease_nodes = [
            GraphNode.from_py2neo(n, display_fn=lambda x: x.get(DISPLAY_NAME_MAP[TYPE_DISEASE]))
                for n in nodes
        ]
        return dict(nodes=[n.to_dict() for n in disease_nodes], edges=[])

    def get_biocyc_db(self, org_ids: [str]):
        if org_ids:
            query = f'match(n:Species) where n.biocyc_id in {str(org_ids)} return labels(n) as node_labels'
            records = list(self.graph.run(query))
            db_labels = []
            for record in records:
                labels = record['labels']
                for label in labels:
                    if label not in set(DB_BIOCYC, NODE_SPECIES):
                        db_labels.append(label)
            return db_labels
        return None

    def load_regulatory_graph(self, req):
        db_filter = self.get_biocyc_db(req.org_ids)
        if req.is_gene():
            query = self.get_gene_regulatory_query(req, db_filter)
            return self._query_neo4j(query)
        return None

    def expand_graph(self, node_id: str, limit: int):
        query = self.get_expand_query(node_id, limit)
        return self._query_neo4j(query)

    def get_association_sentences(self, node_id: str, description: str, entry_text: str):
        query = self.get_association_sentences_query(node_id, description, entry_text)
        data = self.graph.run(query).data()
        return [result['references'] for result in data]

    def load_reaction_graph(self, biocyc_id: str):
        query = self.get_reaction_query(biocyc_id)
        return self._query_neo4j(query)

    def get_graph(self, req):
        # TODO: Make this filter non-static
        db_filter = self.get_biocyc_db(req.org_ids)
        query = ''
        if req.is_gene():
            query = self.get_gene_gpr_query(req, db_filter)
        elif req.is_protein():
            query = self.get_protein_gpr_query(req, db_filter)
        elif req.is_compound():
            query = self.get_compound_query(req, db_filter)
        elif req.is_pathway():
            query = self.get_pathway_gpr_query(req, db_filter)
        elif req.is_chemical():
            query = self.get_chemical_query(req, db_filter)
        return self._query_neo4j(query)

    def get_db_labels(self) -> List[str]:
        """Get all labels from database."""
        labels = self.graph.run('call db.labels()').data()
        return [label['label'] for label in labels]

    def get_node_properties(self, node_label) -> Dict[str, List[str]]:
        """Get all properties of a label."""
        props = self.graph.run(f'match (n: {node_label}) unwind keys(n) as key return distinct key').data()
        return { node_label: [prop['key'] for prop in props] }

    def get_gene_gpr_query(self, req, db_filter: [str]):
        """NOTE: the `get_node_label` is not to get from the database,
        but from the request object class SearchResult.
        """
        gene_label = req.node_label()
        enz_label = req.get_node_label(TYPE_ENZREACTION, req.get_db_labels())
        args = {PROP_BIOCYC_ID: req.id, 'gene_label': gene_label, 'enz_label': enz_label}
        return """
            match(g{gene_label}) where g.biocyc_id = '{biocyc_id}' with g
            optional match p1 = (g)-[:ENCODES]-(:Protein)-[:HAS_COMPONENT*0..3]-(:Protein) unwind nodes(p1) as prot
            optional match p2=(prot)-[:CATALYZES]->(:EnzReaction)-[:HAS_REACTION]->(r:Reaction)
            optional match p3 = ({gene_label})-[:ENCODES]->(:Protein)<-[:HAS_COMPONENT*0..3]-(:Protein)
            -[:CATALYZES]->(enz{enz_label})-[:HAS_REACTION]->(r)
            return [g]+ COALESCE(nodes(p1), [])+ COALESCE(nodes(p2), []) + COALESCE(nodes(p3), []) as nodes,
            COALESCE(relationships(p1), []) + COALESCE(relationships(p2), []) + COALESCE(relationships(p3), []) as relationships
        """.format(**args)

    def get_protein_gpr_query(self, req, db_filter):
        enz_label = req.get_node_label(TYPE_ENZREACTION, req.get_db_labels())
        args = {PROP_BIOCYC_ID: req.id, 'protein_label': req.node_label(), 'enz_label': enz_label}
        return """
            match p1 = ({protein_label})-[:HAS_COMPONENT*0..3]->(n:Protein)-[:HAS_COMPONENT*0..3]->(:Protein)
            where n.biocyc_id = '{biocyc_id}'
            unwind nodes(p1) as prot
            optional match p2=(:Gene)-[:ENCODES]->(prot)
            optional match rp=(prot)-[:CATALYZES]->(:EnzReaction)-[:HAS_REACTION]->(r)
            optional match p3 = (:Gene:Ecocyc)-[:ENCODES]->({protein_label})<-[:HAS_COMPONENT*0..3]-
            (:Protein)-[:CATALYZES]->(enz{enz_label})-[:HAS_REACTION]->(r)
            return COALESCE(nodes(p1), [])+ COALESCE(nodes(p2), []) + COALESCE(nodes(p3), []) as nodes,
            COALESCE(relationships(p1), []) + COALESCE(relationships(p2), []) + COALESCE(relationships(p3), []) as relationships
        """.format(**args)

    def get_pathway_gpr_query(self, req, db_filter:[str]):
        args = {PROP_BIOCYC_ID: req.id}
        query = """
            match (n:Pathway) where n.biocyc_id = '{biocyc_id}'
            with n
            optional match p1 = (n)-[:CONTAINS]-(:Reaction)-[:HAS_REACTION]-(enz:EnzReaction)-[:CATALYZES]-(prot:Protein)
            optional match p2 = (:Gene)-[:ENCODES]->(:Protein)<-[:HAS_COMPONENT*0..3]-(prot)
            return [n]+ COALESCE(nodes(p1), [])+ COALESCE(nodes(p2), []) as nodes,
            COALESCE(relationships(p1), []) + COALESCE(relationships(p2), []) as relationships
        """.format(**args)
        return query

    def get_compound_query(self, req, db_filter:[str]):
        args = {PROP_BIOCYC_ID: req.id}
        return """
            MATCH (c:Compound) where c.biocyc_id='{biocyc_id}'
            with c
            OPTIONAL MATCH p1=(c)-[:IS_CONSUMED_BY]->(:Reaction)
            OPTIONAL Match p2=(c)-[:PRODUCES]-(:Reaction)
            with [c]+ COALESCE(nodes(p1), [])+ COALESCE(nodes(p2), []) as n,
            COALESCE(relationships(p1), []) + COALESCE(relationships(p2), []) as r
            unwind n as allnodes
            unwind r as allrels
            return collect(distinct allnodes) as nodes, collect(distinct allrels) as relationships
        """.format(**args)

    def get_chemical_query(self, req, db_filter:[str]):
        args = {PROP_CHEBI_ID: req.id}
        return """
            match(c:CHEBI) where c.chebi_id = '{chebi_id}' with c
            optional match p1=(c)-[:IS_A]-(:CHEBI)
            optional match p2=(c)-[:IS_CONJUGATE_ACID_OF]-(:CHEBI)
            optional match p3=(c)-[:HAS_PART]-(:CHEBI)
            return [c]+ COALESCE(nodes(p1), [])+ COALESCE(nodes(p2), []) + COALESCE(nodes(p3), []) as nodes,
            COALESCE(relationships(p1), []) + COALESCE(relationships(p2), []) + COALESCE(relationships(p3), []) as relationships
        """.format(**args)

    def get_gene_regulatory_query(self, req, db_filter:[str]):
        args = {PROP_BIOCYC_ID: req.id}
        return """
            match (n:Gene)-[:IS]-(:NCBI:Gene)-[:IS]-(g:Gene:RegulonDB) where n.biocyc_id = 'EG11530' with g
            optional match p1= (:Gene)-[:ENCODES]->(:Product)-[:IS]-(:TranscriptionFactor)-[:REGULATES]->(g)
            optional match p2 = (g)-[:ENCODES]->(:Product)-[:IS]-(:TranscriptionFactor)-[:REGULATES]->(:Gene)
            return [g]+ COALESCE(nodes(p1), [])+ COALESCE(nodes(p2), []) as nodes,
            COALESCE(relationships(p1), []) + COALESCE(relationships(p2), []) as relationships
        """.format(**args)

    # TODO: Allow flexible limits on nodes; enable this in the blueprints
    def get_expand_query(self, node_id: str, limit: int = 50):
        query = """
            MATCH (n)-[l:ASSOCIATED]-(s) WHERE ID(n) = {}
            WITH n, s, l
            LIMIT {}
            return collect(n) + collect(s) as nodes, collect(l) as relationships
        """.format(node_id, limit)
        return query

    # TODO: Need to make a solid version of this query, not sure the current
    # iteration will work 100% of the time
    def get_association_sentences_query(self, node_id: str, description: str, entry_text: str):
        query = """
            MATCH (n)-[:HAS_ASSOCIATION]-(s:Association)-[:HAS_REF]-(r:Reference)
            WHERE ID(n) = {} AND s.description='{}' AND r.entry2_text=~'.*{}.*'
            WITH r
            return r as references
        """.format(node_id, description, entry_text)
        return query

    def get_reaction_query(self, biocyc_id: str):
        query = """
            match(n:Reaction) where n.biocyc_id = '{}' with n
            optional match p1 = (n)-[]-(:EnzReaction)-[:CATALYZES]-(prot:Protein)
            optional match p2 = (:Gene)-[:ENCODES]->(:Protein)<-[:HAS_COMPONENT*0..3]-(prot)
            return [n]+ COALESCE(nodes(p1), [])+ COALESCE(nodes(p2), []) as nodes,
            COALESCE(relationships(p1), []) + COALESCE(relationships(p2), []) as relationships
        """.format(biocyc_id)
        print(query)
        return query

    def parse_file(self, f: FileStorage) -> Workbook:
        workbook = load_workbook(f)
        print(f'caching {f.filename} as key')
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
        def create_node(current_ws, row, props, node_label):
            node = {}  # type: ignore
            node_props = {}

            # value becomes the key representing property label
            # key is used to get the value in excel
            # e.g { prop_label_in_db: cell_value_in_excel_file }
            for k, v in props.items():
                if v:
                    node_props[v] = row[k]
                else:
                    # if user did not select property label
                    # use cell value to make a new one (?)
                    node_props[current_ws.cell(1, k+1).value] = row[k]

            node['data'] = node_props
            node['label'] = node_label  # type: ignore
            node['hash'] = compute_hash(node)  # type: ignore
            return node

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

        # TODO: strip leading and trailing whitespaces
        for row in current_ws.iter_rows(
            min_row=2,
            max_row=len(list(current_ws.rows)) - 1,
            max_col=len(list(current_ws.columns)) - 1,
            values_only=True,
        ):
            # # did user select a node label or not
            src_node_label = list(source_col_idx_node_label.values())[0] or row[list(source_col_idx_node_label.keys())[0]]
            src_node = create_node(
                current_ws=current_ws, row=row, props=source_col_idx_node_prop, node_label=src_node_label)
            nodes.append(src_node)

            if len(target_col_idx_node_label) > 0:
                tgt_node_label = list(target_col_idx_node_label.values())[0] or row[list(target_col_idx_node_label.keys())[0]]
                tgt_node = create_node(
                    current_ws=current_ws, row=row, props=target_col_idx_node_prop, node_label=tgt_node_label)
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
