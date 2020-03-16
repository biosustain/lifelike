import attr
from typing import Dict, List, Optional, Union

from neo4japp.data_transfer_objects.visualization import (
    ClusteredNode,
    DuplicateNodeEdgePair,
    DuplicateVisEdge,
    EdgeSnippetCount,
    GetClusterGraphDataResult,
    GetReferenceTableDataResult,
    GetSnippetCountsFromEdgesResult,
    GetSnippetsFromEdgeResult,
    ReferenceTableRow,
    VisEdge,
)
from neo4japp.services.common import GraphBaseDao
from neo4japp.models import GraphNode, GraphRelationship
from neo4japp.constants import *
from neo4japp.factory import cache
from neo4japp.util import CamelDictMixin, compute_hash, snake_to_camel_dict

from py2neo import (
    Graph,
    Node,
    Transaction,
    NodeMatch,
    NodeMatcher,
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
        node_type: str = attr.ib()
        node_properties: Dict[int, str] = attr.ib()
        mapped_node_type: str = attr.ib()
        mapped_node_property: str = attr.ib()
        # this will be used to match a node
        unique_property: str = attr.ib()

    @attr.s(frozen=True)
    class Neo4jRelationshipMapping(CamelDictMixin):
        @attr.s(frozen=True)
        class ExistingGraphDBMapping(CamelDictMixin):
            mapped_node_type: str = attr.ib()
            mapped_node_property: Dict[int, str] = attr.ib()

        edge: str = attr.ib()
        edge_property: Dict[int, str] = attr.ib()
        source_node: ExistingGraphDBMapping = attr.ib()
        target_node: ExistingGraphDBMapping = attr.ib()

    file_name: str = attr.ib()
    sheet_name: str = attr.ib()
    node: Optional[Neo4jNodeMapping] = attr.ib(default=None)
    relationship: Optional[Neo4jRelationshipMapping] = attr.ib(default=None)


class Neo4JService(GraphBaseDao):
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

    def get_snippets_from_edge(self, edge: VisEdge):
        query = self.get_snippets_from_edge_query(edge.from_, edge.to, edge.label)

        data = self.graph.run(query).data()
        return GetSnippetsFromEdgeResult(
            from_node_id=edge.from_,
            to_node_id=edge.to,
            association=edge.label,
            references=[result['references'] for result in data]
        )

    def get_snippets_from_duplicate_edge(self, edge: DuplicateVisEdge):
        query = self.get_snippets_from_edge_query(edge.original_from, edge.original_to, edge.label)

        data = self.graph.run(query).data()
        return GetSnippetsFromEdgeResult(
            from_node_id=edge.from_,
            to_node_id=edge.to,
            association=edge.label,
            references=[result['references'] for result in data]
        )

    def get_snippet_counts_from_edges(self, edges: List[VisEdge]):
        edge_snippet_counts: List[EdgeSnippetCount] = []
        for edge in edges:
            query = self.get_association_snippet_count_query(edge.from_, edge.to, edge.label)
            count = self.graph.run(query).evaluate()
            edge_snippet_counts.append(EdgeSnippetCount(
                edge=edge,
                count=count,
            ))
        return GetSnippetCountsFromEdgesResult(
            edge_snippet_counts=edge_snippet_counts,
        )

    def get_reference_table_data(self, node_edge_pairs: List[DuplicateNodeEdgePair]):
        reference_table_rows: List[ReferenceTableRow] = []
        for pair in node_edge_pairs:
            node = pair.node
            edge = pair.edge

            query = self.get_association_snippet_count_query(edge.original_from, edge.original_to, edge.label)
            count = self.graph.run(query).evaluate()
            reference_table_rows.append(ReferenceTableRow(
                node_display_name=node.display_name,
                snippet_count=count,
                edge=edge,
            ))
        return GetReferenceTableDataResult(
            reference_table_rows=reference_table_rows
        )

    def get_cluster_graph_data(self, clustered_nodes: List[ClusteredNode]):
        results: Dict[int, Dict[str, int]] = dict()

        for node in clustered_nodes:
            for edge in node.edges:
                query = self.get_association_snippet_count_query(edge.original_from, edge.original_to, edge.label)
                count = self.graph.run(query).evaluate()

                if (results.get(node.node_id, None) is not None):
                    results[node.node_id][edge.label] = count
                else:
                    results[node.node_id] = {edge.label: count}

        return GetClusterGraphDataResult(
            results=results,
        )

    def load_reaction_graph(self, biocyc_id: str):
        query = self.get_reaction_query(biocyc_id)
        return self._query_neo4j(query)

    def query_batch(self, data_query: str):
        """ query batch uses a custom query language (one we make up here)
        for returning a list of nodes and their relationships.
        It also works on single nodes with no relationship.

        Example:
            If we wanted all relationships between
            the node pairs (node1, node2) and
            (node3, node4), we will write the
            query as follows:

                node1,node2&node3,node4
        """

        data_query = data_query.split('&')

        if len(data_query) == 1 and data_query[0].find(',') == -1:
            cypher_query = '''
            MATCH (n) WHERE ID(n)={nid} RETURN n AS nodeA
            '''.format(nid=int(data_query.pop()))
            node = self.graph.evaluate(cypher_query)
            graph_node = GraphNode.from_py2neo(
                node,
                display_fn=lambda x: x.get(DISPLAY_NAME_MAP[next(iter(node.labels), set())]),
            )
            return dict(nodes=[graph_node.to_dict()], edges=[])
        else:
            data = [x.split(',') for x in data_query]
            query_generator = [
                'MATCH (nodeA)-[relationship]->(nodeB) WHERE id(nodeA)={from_} '
                'AND id(nodeB)={to} RETURN *'.format(
                    from_=int(from_),
                    to=int(to),
                ) for from_, to in data]
            cypher_query = ' UNION '.join(query_generator)
            records = self.graph.run(cypher_query).data()
            if not records:
                return None
            node_dict = dict()
            rel_dict = dict()
            for row in records:
                nodeA = row['nodeA']
                nodeB = row['nodeB']
                relationship = row['relationship']
                graph_nodeA = GraphNode.from_py2neo(
                    nodeA,
                    display_fn=lambda x: x.get(DISPLAY_NAME_MAP[next(iter(nodeA.labels), set())])
                )
                graph_nodeB = GraphNode.from_py2neo(
                    nodeB,
                    display_fn=lambda x: x.get(DISPLAY_NAME_MAP[next(iter(nodeB.labels), set())])
                )
                rel = GraphRelationship.from_py2neo(relationship)
                node_dict[graph_nodeA.id] = graph_nodeA
                node_dict[graph_nodeB.id] = graph_nodeB
                rel_dict[rel.id] = rel
            return dict(
                nodes=[n.to_dict() for n in node_dict.values()],
                edges=[r.to_dict() for r in rel_dict.values()],
            )

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

    def get_db_relationship_types(self) -> List[str]:
        """Get all relationship types from database."""
        relationship_types = self.graph.run('call db.relationshipTypes()').data()
        return [rt['relationshipType'] for rt in relationship_types]

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

    def get_snippets_from_edge_query(self, from_node: int, to_node: int, association: str):
        query = """
            MATCH (f)-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(t)
            WHERE ID(f)={} AND ID(t)={} AND a.description='{}'
            WITH a AS association MATCH (association)-[:HAS_REF]-(r:Reference)
            RETURN r AS references
        """.format(from_node, to_node, association)
        return query

    def get_association_snippet_count_query(self, from_node: int, to_node: int, association: str):
        query = """
            MATCH (f)-[:HAS_ASSOCIATION]->(a:Association)-[:HAS_ASSOCIATION]->(t)
            WHERE ID(f)={} AND ID(t)={} AND a.description='{}'
            WITH a AS association MATCH (association)-[:HAS_REF]-(r:Reference)
            RETURN COUNT(r) as count
        """.format(from_node, to_node, association)
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
