import attr
from typing import Dict, List

from flask import current_app

from neo4japp.constants import BIOCYC_ORG_ID_DICT

from neo4japp.services.common import HybridDBDao
from neo4japp.models import (
    DomainURLsMap,
    GraphNode,
    GraphRelationship
)
from neo4japp.constants import (
    DISPLAY_NAME_MAP,
    TYPE_CHEMICAL,
    TYPE_GENE,
    TYPE_DISEASE,
)
from neo4japp.util import get_first_known_label_from_node
from neo4japp.utils.logger import EventLog

from py2neo import (
    Node,
    Relationship,
)


class KgService(HybridDBDao):
    def __init__(self, graph, session):
        super().__init__(graph=graph, session=session)

    def _get_uri_of_node_entity(self, node: Node, url_map: Dict[str, str]):
        """Given a node and a map of domains -> URLs, returns the appropriate
        URL formatted with the node entity identifier.
        """
        label = get_first_known_label_from_node(node)
        entity_id = node.get('id')

        # Can't get the URI of the node if there is no 'id' property, so return None
        if entity_id is None:
            current_app.logger.warning(
                f'Node with ID {node.identity} does not have a URI.',
                extra=EventLog(event_type='node does not have a URI').to_dict()
            )
            return None

        url = None
        try:
            if label == TYPE_CHEMICAL:
                db_prefix, uid = entity_id.split(':')
                if db_prefix == 'CHEBI':
                    url = url_map['chebi'].format(uid)
                else:
                    url = url_map['MESH'].format(uid)
            elif label == TYPE_DISEASE:
                db_prefix, uid = entity_id.split(':')
                if db_prefix == 'MESH':
                    url = url_map['MESH'].format(uid)
                else:
                    url = url_map['omim'].format(uid)
            elif label == TYPE_GENE:
                url = url_map['NCBI_Gene'].format(entity_id)
        except KeyError:
            current_app.logger.warning(
                f'url_map did not contain the expected key value for node with:\n' +
                f'\tID: {node.identity}\n'
                f'\tLabel: {label}\n' +
                f'\tURI: {entity_id}\n'
                'There may be something wrong in the database.',
                extra=EventLog(event_type='node domain does not exist in postgres').to_dict()
            )
        finally:
            return url

    def _neo4j_objs_to_graph_objs(self, nodes: List[Node], relationships: List[Relationship]):
        # TODO: Can possibly use a dispatch method/injection
        # of sorts to use custom labeling methods for
        # different type of nodes/edges being converted.
        # The default does not always set an appropriate label
        # name.
        node_dict = {}
        rel_dict = {}

        # TODO: Maybe this would be more appropriate as a class property?
        url_map = {
            domain: base_url
            for domain, base_url in
            self.session.query(
                DomainURLsMap.domain,
                DomainURLsMap.base_URL,
            ).all()
        }

        for node in nodes:
            graph_node = GraphNode.from_py2neo(
                node,
                url_fn=lambda x: self._get_uri_of_node_entity(x, url_map),
                display_fn=lambda x: x.get(DISPLAY_NAME_MAP[get_first_known_label_from_node(x)]),  # type: ignore  # noqa
                primary_label_fn=get_first_known_label_from_node,
            )
            node_dict[graph_node.id] = graph_node

        for rel in relationships:
            graph_rel = GraphRelationship.from_py2neo(rel)
            rel_dict[graph_rel.id] = graph_rel
        return {
            'nodes': [n.to_dict() for n in node_dict.values()],
            'edges': [r.to_dict() for r in rel_dict.values()]
        }

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

        # TODO: This no longer works as expected with the refactor of the visualizer
        # search. May need to refactor this in the future, or just get rid of it.
        split_data_query = data_query.split('&')

        if len(split_data_query) == 1 and split_data_query[0].find(',') == -1:
            query = """
                MATCH (n) WHERE ID(n)=$node_id RETURN n AS node
            """
            result = self.graph.run(
                query,
                {
                    'node_id': int(split_data_query.pop())
                }
            ).data()

            node = []
            if len(result) > 0:
                node = [result[0]['node']]

            return self._neo4j_objs_to_graph_objs(node, [])
        else:
            data = [x.split(',') for x in split_data_query]
            query = """
                UNWIND $data as node_pair
                WITH node_pair[0] as from_id, node_pair[1] as to_id
                MATCH (a)-[relationship]->(b)
                WHERE ID(a)=from_id AND ID(b)=to_id
                RETURN
                    apoc.convert.toSet(collect(a) + collect(b)) as nodes,
                    apoc.convert.toSet(collect(relationship)) as relationships
            """
            result = self.graph.run(
                query,
                {
                    'data': data
                }
            ).data()

            nodes = []
            relationships = []
            if len(result) > 0:
                nodes = result[0]['nodes']
                relationships = result[0]['relationships']

            return self._neo4j_objs_to_graph_objs(nodes, relationships)

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
        props = self.graph.run(f'match (n: {node_label}) unwind keys(n) as key return distinct key').data()  # noqa
        return {node_label: [prop['key'] for prop in props]}

    def get_uniprot_genes(
        self,
        ncbi_gene_ids: List[int],
    ):
        query = self.get_uniprot_genes_query()
        result = self.graph.run(
            query,
            {
                'ncbi_gene_ids': ncbi_gene_ids,
            }
        ).data()
        result_list = []
        domain = self.session.query(DomainURLsMap).filter(
                                        DomainURLsMap.domain == 'uniprot').one()
        for meta_result in result:
            item = {'result': meta_result['x']}
            if (meta_result['x'] is not None):
                meta_id = meta_result['x']['id']
                item['link'] = domain.base_URL.format(meta_id)
            result_list.append(item)
        return result_list

    def get_string_genes(
        self,
        ncbi_gene_ids: List[int],
    ):
        query = self.get_string_genes_query()
        result = self.graph.run(
            query,
            {
                'ncbi_gene_ids': ncbi_gene_ids,
            }
        ).data()
        result_list = []
        for meta_result in result:
            item = {'result': meta_result['x']}
            if (meta_result['x'] is not None):
                refseq = meta_result['x']['id']
                item['link'] = f'https://string-db.org/cgi/network?identifiers={refseq}'
            result_list.append(item)
        return result_list

    def get_molecular_go_genes(
        self,
        ncbi_gene_ids: List[int],
    ):
        query = self.get_molecular_go_genes_query()
        result = self.graph.run(
            query,
            {
                'ncbi_gene_ids': ncbi_gene_ids,
            }
        ).data()
        result_list = []
        domain = self.session.query(DomainURLsMap).filter(
                                        DomainURLsMap.domain == 'go').one()
        for meta_result in result:
            xArray = meta_result['xArray']
            item = {'result': xArray}
            if (xArray is not None):
                link_list = []
                for go in xArray:
                    link_list.append(domain.base_URL.format(go['id']))
                item['linkList'] = link_list
            result_list.append(item)
        return result_list

    def get_biological_go_genes(
        self,
        ncbi_gene_ids: List[int],
    ):
        query = self.get_biological_go_genes_query()
        result = self.graph.run(
            query,
            {
                'ncbi_gene_ids': ncbi_gene_ids,
            }
        ).data()
        result_list = []
        domain = self.session.query(DomainURLsMap).filter(
                                        DomainURLsMap.domain == 'go').one()
        for meta_result in result:
            xArray = meta_result['xArray']
            item = {'result': xArray}
            if (xArray is not None):
                link_list = []
                for go in xArray:
                    link_list.append(domain.base_URL.format(go['id']))
                item['linkList'] = link_list
            result_list.append(item)
        return result_list

    def get_cellular_go_genes(
        self,
        ncbi_gene_ids: List[int],
    ):
        query = self.get_cellular_go_genes_query()
        result = self.graph.run(
            query,
            {
                'ncbi_gene_ids': ncbi_gene_ids,
            }
        ).data()
        result_list = []
        domain = self.session.query(DomainURLsMap).filter(
                                        DomainURLsMap.domain == 'go').one()
        for meta_result in result:
            xArray = meta_result['xArray']
            item = {'result': xArray}
            if (xArray is not None):
                link_list = []
                for go in xArray:
                    link_list.append(domain.base_URL.format(go['id']))
                item['linkList'] = link_list
            result_list.append(item)
        return result_list

    def get_biocyc_genes(
        self,
        ncbi_gene_ids: List[int],
        taxID: str
    ):
        query = self.get_biocyc_genes_query()
        result = self.graph.run(
            query,
            {
                'ncbi_gene_ids': ncbi_gene_ids,
            }
        ).data()
        result_list = []
        for meta_result in result:
            item = {'result': meta_result['x']}
            if (meta_result['x'] is not None):
                biocyc_id = meta_result['x']['biocyc_id']
                if taxID in BIOCYC_ORG_ID_DICT.keys():
                    orgID = BIOCYC_ORG_ID_DICT[taxID]
                    item['link'] = f'https://biocyc.org/gene?orgid={orgID}&id={biocyc_id}'
                else:
                    item['link'] = f'https://biocyc.org/gene?id={biocyc_id}'
            result_list.append(item)
        return result_list

    def get_go_genes(
        self,
        ncbi_gene_ids: List[int],
    ):
        query = self.get_go_genes_query()
        result = self.graph.run(
            query,
            {
                'ncbi_gene_ids': ncbi_gene_ids,
            }
        ).data()
        result_list = []
        domain = 'https://www.ebi.ac.uk/QuickGO/annotations?geneProductId='
        for meta_result in result:
            xArray = meta_result['xArray']
            item = {'result': xArray}
            if (xArray is not None):
                item['link'] = domain
            result_list.append(item)
        return result_list

    def get_regulon_genes(
        self,
        ncbi_gene_ids: List[int],
    ):
        query = self.get_regulon_genes_query()
        result = self.graph.run(
            query,
            {
                'ncbi_gene_ids': ncbi_gene_ids,
            }
        ).data()
        result_list = []
        for meta_result in result:
            item = {'result': meta_result['x']}
            if (meta_result['x'] is not None):
                regulondb_id = meta_result['x']['regulondb_id']
                item['link'] = f'http://regulondb.ccg.unam.mx/gene?term={regulondb_id}' \
                    '&organism=ECK12&format=jsp&type=gene'
            result_list.append(item)
        return result_list

    def get_uniprot_genes_query(self):
        return """
        MATCH (g:Gene:db_NCBI)
        WHERE ID(g) IN $ncbi_gene_ids
        OPTIONAL MATCH (g)-[:HAS_GENE]-(x:db_UniProt)
        RETURN x
        """

    def get_string_genes_query(self):
        return """
        MATCH (g:Gene:db_NCBI)
        WHERE ID(g) IN $ncbi_gene_ids
        OPTIONAL MATCH (g)-[:GENE_LINK]-(x:db_STRING)
        RETURN x
        """

    def get_molecular_go_genes_query(self):
        return """
        MATCH (g:Gene:db_NCBI)
        WHERE ID(g) IN $ncbi_gene_ids
        OPTIONAL MATCH (g)-[:GO_LINK]-(x:MolecularFunction:db_GO)
        RETURN g, collect(x) as xArray
        """

    def get_biological_go_genes_query(self):
        return """
        MATCH (g:Gene:db_NCBI)
        WHERE ID(g) IN $ncbi_gene_ids
        OPTIONAL MATCH (g)-[:GO_LINK]-(x:BiologicalProcess:db_GO)
        RETURN g, collect(x) as xArray
        """

    def get_cellular_go_genes_query(self):
        return """
        MATCH (g:Gene:db_NCBI)
        WHERE ID(g) IN $ncbi_gene_ids
        OPTIONAL MATCH (g)-[:GO_LINK]-(x:CellularComponent:db_GO)
        RETURN g, collect(x) as xArray
        """

    def get_go_genes_query(self):
        return """
        MATCH (g:Gene:db_NCBI)
        WHERE ID(g) IN $ncbi_gene_ids
        OPTIONAL MATCH (g)-[:GO_LINK]-(x:db_GO)
        RETURN g, collect(x) as xArray
        """

    def get_biocyc_genes_query(self):
        return """
        MATCH (g:Gene:db_NCBI)
        WHERE ID(g) IN $ncbi_gene_ids
        OPTIONAL MATCH (g)-[:IS]-(x:db_BioCyc)
        RETURN x
        """

    def get_regulon_genes_query(self):
        return """
        MATCH (g:Gene:db_NCBI)
        WHERE ID(g) IN $ncbi_gene_ids
        OPTIONAL MATCH (g)-[:IS]-(x:db_RegulonDB)
        RETURN x
        """
