import json
import os
import time

from flask import current_app
from neo4j import Transaction as Neo4jTx
from neo4j.graph import Node as N4jDriverNode, Relationship as N4jDriverRelationship
from typing import Dict, List

from neo4japp.constants import (
    BIOCYC_ORG_ID_DICT,
)
from neo4japp.exceptions import ServerException
from neo4japp.services.common import HybridDBDao
from neo4japp.models import (
    DomainURLsMap,
    GraphNode,
    GraphRelationship
)
from neo4japp.constants import (
    ANNOTATION_STYLES_DICT,
    DISPLAY_NAME_MAP,
    LogEventType,
)
from neo4japp.util import (
    get_first_known_label_from_list,
    get_first_known_label_from_node,
    snake_to_camel_dict
)
from neo4japp.utils.logger import EventLog


class KgService(HybridDBDao):
    def __init__(self, graph, session):
        super().__init__(graph=graph, session=session)

    def _neo4j_objs_to_graph_objs(
        self,
        nodes: List[N4jDriverNode],
        relationships: List[N4jDriverRelationship],
    ):
        # TODO: Can possibly use a dispatch method/injection
        # of sorts to use custom labeling methods for
        # different type of nodes/edges being converted.
        # The default does not always set an appropriate label
        # name.
        node_dict = {}
        rel_dict = {}

        for node in nodes:
            label = get_first_known_label_from_node(node)
            graph_node = GraphNode(
                id=node.id,
                label=get_first_known_label_from_node(node),
                sub_labels=list(node.labels),
                domain_labels=[],
                display_name=node.get(DISPLAY_NAME_MAP[label]),
                data=snake_to_camel_dict(dict(node), {}),
                url=None
            )
            node_dict[graph_node.id] = graph_node

        for rel in relationships:
            graph_rel = GraphRelationship(
                id=rel.id,
                label=type(rel).__name__,
                data=dict(rel),
                to=rel.end_node.id,
                _from=rel.start_node.id,
                to_label=list(rel.end_node.labels)[0],
                from_label=list(rel.start_node.labels)[0]
            )
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
            result = self.graph.read_transaction(
                lambda tx: list(
                    tx.run(
                        'MATCH (n) WHERE ID(n)=$node_id RETURN n AS node',
                        node_id=int(split_data_query.pop())
                    )
                )
            )

            node = []
            if len(result) > 0:
                node = [result[0]['node']]

            return self._neo4j_objs_to_graph_objs(node, [])
        else:
            data = [x.split(',') for x in split_data_query]
            result = self.graph.read_transaction(
                lambda tx: list(
                    tx.run(
                        """
                        UNWIND $data as node_pair
                        WITH node_pair[0] as from_id, node_pair[1] as to_id
                        MATCH (a)-[relationship]->(b)
                        WHERE ID(a)=from_id AND ID(b)=to_id
                        RETURN
                            apoc.convert.toSet(collect(a) + collect(b)) as nodes,
                            apoc.convert.toSet(collect(relationship)) as relationships
                        """,
                        data=data
                    )
                )
            )

            nodes = []
            relationships = []
            if len(result) > 0:
                nodes = result[0]['nodes']
                relationships = result[0]['relationships']

            return self._neo4j_objs_to_graph_objs(nodes, relationships)

    def get_db_labels(self) -> List[str]:
        """Get all labels from database."""
        labels = self.graph.read_transaction(lambda tx: list(tx.run('call db.labels()')))
        return [label['label'] for label in labels]

    def get_db_relationship_types(self) -> List[str]:
        """Get all relationship types from database."""
        relationship_types = self.graph.read_transaction(
            lambda tx: list(tx.run('call db.relationshipTypes()'))
        )
        return [rt['relationshipType'] for rt in relationship_types]

    def get_node_properties(self, node_label) -> Dict[str, List[str]]:
        """Get all properties of a label."""
        props = self.graph.read_transaction(lambda tx: list(tx.run(f'match (n: {node_label}) unwind keys(n) as key return distinct key')))  # noqa
        return {node_label: [prop['key'] for prop in props]}

    def get_uniprot_genes(self, ncbi_gene_ids: List[int]):
        start = time.time()
        results = self.graph.read_transaction(
            self.get_uniprot_genes_query,
            ncbi_gene_ids
        )

        current_app.logger.info(
            f'Enrichment UniProt KG query time {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
        )

        domain = self.session.query(DomainURLsMap).filter(
            DomainURLsMap.domain == 'uniprot').one_or_none()

        if domain is None:
            raise ServerException(
                title='Could not create enrichment table',
                message='There was a problem finding UniProt domain URLs.')

        return {
            result['node_id']: {
                'result': {'id': result['uniprot_id'], 'function': result['function']},
                'link': domain.base_URL.format(result['uniprot_id'])
            } for result in results}

    def get_string_genes(self, ncbi_gene_ids: List[int]):
        start = time.time()
        results = self.graph.read_transaction(
            self.get_string_genes_query,
            ncbi_gene_ids
        )

        current_app.logger.info(
            f'Enrichment String KG query time {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
        )

        return {
            result['node_id']: {
                'result': {'id': result['string_id'], 'annotation': result['annotation']},
                'link': f"https://string-db.org/cgi/network?identifiers={result['string_id']}"
            } for result in results}

    def get_biocyc_genes(
        self,
        ncbi_gene_ids: List[int],
        tax_id: str
    ):
        start = time.time()
        results = self.graph.read_transaction(
            self.get_biocyc_genes_query,
            ncbi_gene_ids
        )

        current_app.logger.info(
            f'Enrichment Biocyc KG query time {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
        )

        return {
            result['node_id']: {
                'result': result['pathways'],
                'link': f"https://biocyc.org/gene?orgid={BIOCYC_ORG_ID_DICT[tax_id]}&id={result['biocyc_id']}"  # noqa
                    if tax_id in BIOCYC_ORG_ID_DICT else f"https://biocyc.org/gene?id={result['biocyc_id']}"  # noqa
            } for result in results}

    def get_go_genes(self, ncbi_gene_ids: List[int]):
        start = time.time()
        results = self.graph.read_transaction(
            self.get_go_genes_query,
            ncbi_gene_ids,
        )

        current_app.logger.info(
            f'Enrichment GO KG query time {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
        )

        return {
            result['node_id']: {
                'result': result['go_terms'],
                'link': 'https://www.ebi.ac.uk/QuickGO/annotations?geneProductId='
            } for result in results}

    def get_regulon_genes(self, ncbi_gene_ids: List[int]):
        start = time.time()
        results = self.graph.read_transaction(
            self.get_regulon_genes_query,
            ncbi_gene_ids
        )

        current_app.logger.info(
            f'Enrichment Regulon KG query time {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
        )

        return {
            result['node_id']: {
                'result': result['node'],
                'link': f"http://regulondb.ccg.unam.mx/gene?term={result['regulondb_id']}&organism=ECK12&format=jsp&type=gene"  # noqa
            } for result in results}

    def get_kegg_genes(self, ncbi_gene_ids: List[int]):
        start = time.time()
        results = self.graph.read_transaction(
            self.get_kegg_genes_query,
            ncbi_gene_ids
        )

        current_app.logger.info(
            f'Enrichment KEGG KG query time {time.time() - start}',
            extra=EventLog(event_type=LogEventType.ENRICHMENT.value).to_dict()
        )

        return {
            result['node_id']: {
                'result': result['pathway'],
                'link': f"https://www.genome.jp/entry/{result['kegg_id']}"
            } for result in results}

    def get_nodes_and_edges_from_paths(self, paths):
        nodes = []
        node_ids = set()
        edges = []
        edge_ids = set()
        for path in paths:
            if path.get('nodes', None) is not None:
                for node in path['nodes']:
                    if node['id'] not in node_ids:
                        node_display_name = 'Node Display Name Unknown'
                        if node.get('display_name', None) is not None:
                            node_display_name = node['display_name']
                        elif node.get('name', None) is not None:
                            node_display_name = node['name']

                        try:
                            node_label = get_first_known_label_from_list(node['labels'])
                            node_color = ANNOTATION_STYLES_DICT[node_label.lower()]['color']
                        except ValueError:
                            # If label is unknown, then use fallbacks
                            node_label = 'Unknown'
                            node_color = '#000000'
                            current_app.logger.warning(
                                f"Node had an unexpected list of labels: {node['labels']}",
                                extra=EventLog(
                                    event_type=LogEventType.KNOWLEDGE_GRAPH.value
                                ).to_dict()
                            )
                        except KeyError:
                            # If label does not exist in styles dict, then use fallbacks
                            node_label = 'Unknown'
                            node_color = '#000000'

                        node_data = {
                            'id': node['id'],
                            'label': node_display_name,
                            'databaseLabel': node_label,
                            'font': {
                                'color': node_color,
                            },
                            'color': {
                                'background': '#FFFFFF',
                                'border': node_color,
                                'hover': {
                                    'background': '#FFFFFF',
                                    'border': node_color,
                                },
                                'highlight': {
                                    'background': '#FFFFFF',
                                    'border': node_color,
                                },
                            }
                        }

                        nodes.append(node_data)
                        node_ids.add(node['id'])

            if path.get('edges', None) is not None:
                for edge in path['edges']:
                    if edge['id'] not in edge_ids:
                        edge_data = {
                            'id': edge['id'],
                            'label': edge['type'],
                            'from': edge['start_node'],
                            'to': edge['end_node'],
                            'color': {
                                'color': '#0c8caa',
                            },
                            'arrows': 'to',
                        }

                        edges.append(edge_data)
                        edge_ids.add(edge['id'])
        return {'nodes': nodes, 'edges': edges}

    def get_shortest_path_query_list(self):
        query_pathway_names = [
            '3-hydroxyisobutyric Acid to pykF Using ChEBI',
            '3-hydroxyisobutyric Acid to pykF using BioCyc',
            'icd to rhsE',
            'Two pathways using BioCyc',
            # 'Glycolisis Regulon',
            # 'SIRT5 to NFE2L2 Using Literature Data',
            # 'CTNNB1 to Diarrhea Using Literature Data',
        ]
        file_pathway_names = [
            'Serine SP Pathway',
            'Serine to malZp',
            'Acetate (ALE Mutation Data)',
            'Glycerol (ALE Mutation Data)',
            'Hexanoic (ALE Mutation Data)',
            'Isobutyric (ALE Mutation Data)',
            'Putrescine (ALE Mutation Data)',
            'Serine (ALE Mutation Data)',
            'tpiA (ALE Mutation Data)',
            'Xylose (ALE Mutation Data)',
            '42C Temperature (ALE Mutation Data)',
            'nagC (ALE Mutation Data)',
            'nagA/nagC (ALE Mutation Data)',
            'nagA/nagC Shortest Paths (ALE Mutation Data)',
            'metab2PTHLH Short',
            'PTHLH2metab Short',
            'metab2PTHLH Short Page',
            'PTHLH2metab Short Page',
            'PTHLH2Ca2metab Short Page',
            'AAK1',
            'Auxilin Recruits HSPA8',
            'CSNK1D Phosphorylates SEC23',
            'Dissociation of AAK1 and Dephosphorylation of AP-2 mu2',
            'Expression of PERIOD-1',
            'F_BAR proteins_ARP',
            'HSPA8-mediated ATP Hydrolysis Promotes Vesicle Uncoating',
            'Interleukin-1 Family are Secreted',
            'PER1 [cytosol]',
            'The Ligand_GPCR_Gs Complex Dissociates',
            'Vesicle Budding',
            'Min Mean Short Updown Serotonin',
            'Min Mean Short Metabs Acetate',
            'Min Mean Short Metabs Butyrate',
            'Min Mean Short Metabs Propionate',
            'Min Mean Short Metabs Serotonin',
            'Min Mean Short Metabs top10',
            'Min Mean Short Updown Acetate',
            'Min Mean Short Updown Butyrate',
            'AAK1 to Metab noOct',
            'FosB to PER1',
            'Uncharacterized iModulon Genes and Top 20 Metabolites',
            'Uncharacterized iModulon Genes Only',
            'Uncharacterized iModulon Genes to Methionine',
            'Uncharacterized iModulon Genes yjdI Metabolites',
            'Zink iModulon Metals',
            'Zink iModulon Test2'
            # 'nagA (ALE Mutation Data)',
        ]
        return {num: name for num, name in enumerate(query_pathway_names + file_pathway_names)}

    def get_query_id_to_func_map(self):
        query_pathways = [
            self.get_three_hydroxisobuteric_acid_to_pykf_chebi_query,
            self.get_three_hydroxisobuteric_acid_to_pykf_biocyc_query,
            self.get_icd_to_rhse_query,
            self.get_two_pathways_biocyc_query
            # self.get_glycolisis_regulon_query,
            # self.get_sirt5_to_nfe2l2_literature_query,
            # self.get_ctnnb1_to_diarrhea_literature_query,
        ]
        file_pathways = [
            'serine.json',
            'serine-to-malZp.json',
            'ale_mutation_data/acetate.json',
            'ale_mutation_data/glycerol.json',
            'ale_mutation_data/hexanoic.json',
            'ale_mutation_data/isobutyric.json',
            'ale_mutation_data/putrescine.json',
            'ale_mutation_data/serine.json',
            'ale_mutation_data/tpiA.json',
            'ale_mutation_data/xylose.json',
            'ale_mutation_data/42C.json',
            'ale_mutation_data/nagC.json',
            'ale_mutation_data/nagAC.json',
            'ale_mutation_data/nagAC_shortestpaths.json',
            'cytoscape_data/metab2PTHLH_short_graphml.json',
            'cytoscape_data/PTHLH2metab_short_graphml.json',
            'cytoscape_data/metab2PTHLH_shortPage_graphml.json',
            'cytoscape_data/PTHLH2metab_shortPage_graphml.json',
            'cytoscape_data/PTHLH2Ca2metab_shortPage_graphml.json',
            'cytoscape_data/aak1_graphml.json',
            'cytoscape_data/Auxilin recruits HSPA8.json',
            'cytoscape_data/CSNK1D phosphorylates SEC23.json',
            'cytoscape_data/Dissociation of AAK1 and dephosphorylation of AP-2 mu2.json',
            'cytoscape_data/Expression of PERIOD-1.json',
            'cytoscape_data/F_BAR proteins_ARP.json',
            'cytoscape_data/HSPA8-mediated ATP hydrolysis promotes vesicle uncoating.json',
            'cytoscape_data/Interleukin-1 family are secreted.json',
            'cytoscape_data/PER1 [cytosol].json',
            'cytoscape_data/The Ligand_GPCR_Gs complex dissociates.json',
            'cytoscape_data/Vesicle budding.json',
            'cytoscape_data/minMeanShort_updown_Serotonin_graphml.json',
            'cytoscape_data/minMeanShort_metabs_Acetate_graphml.json',
            'cytoscape_data/minMeanShort_metabs_Butyrate_graphml.json',
            'cytoscape_data/minMeanShort_metabs_Propionate_graphml.json',
            'cytoscape_data/minMeanShort_metabs_Serotonin_graphml.json',
            'cytoscape_data/minMeanShort_metabs_top10_graphml.json',
            'cytoscape_data/minMeanShort_updown_Acetate_graphml.json',
            'cytoscape_data/minMeanShort_updown_Butyrate_graphml.json',
            'cytoscape_data/aak1_to_metab_noOct_graphml.json',
            'cytoscape_data/FosB to PER1_vis_js.json',
            'marina_sankey_data/uncharacterized_iModulon_genes_and_top20_metabolites_vis_js.json',
            'marina_sankey_data/uncharacterized_iModulon_genes_only_vis_js.json',
            'marina_sankey_data/uncharacterized_iModulon_genes_to_methionine_vis_js.json',
            'marina_sankey_data/uncharacterized_iModulon_genes_yjdI_metabolites_vis_js.json',
            'marina_sankey_data/zink-imodulon-metals_vis_js.json',
            'marina_sankey_data/zink-imodulon-test2_vis_js.json'
            # 'ale_mutation_data/nagA.json',
        ]

        pathway_num = 0
        pathways = dict()
        for query_pathway in query_pathways:
            pathways[pathway_num] = [self.get_data_from_query, query_pathway]
            pathway_num += 1

        for file_pathway in file_pathways:
            pathways[pathway_num] = [self.get_data_from_file, file_pathway]
            pathway_num += 1

        return pathways

    def get_shortest_path_data(self, query_id):
        func, arg = self.get_query_id_to_func_map()[query_id]
        return func(arg)

    def get_data_from_query(self, query_func):
        result = self.graph.read_transaction(query_func)
        return self.get_nodes_and_edges_from_paths(result)

    def get_data_from_file(self, filename):
        directory = os.path.realpath(os.path.dirname(__file__))
        with open(os.path.join(directory, f'./shortest_path_data/{filename}'), 'r') as data_file:
            return json.load(data_file)

    def get_uniprot_genes_query(self, tx: Neo4jTx, ncbi_gene_ids: List[int]) -> List[dict]:
        return tx.run(
            """
            UNWIND $ncbi_gene_ids AS node_id
            MATCH (g)-[:HAS_GENE]-(x:db_UniProt)
            WHERE id(g)=node_id
            RETURN node_id, x.function AS function, x.eid AS uniprot_id
            """,
            ncbi_gene_ids=ncbi_gene_ids
        ).data()

    def get_string_genes_query(self, tx: Neo4jTx, ncbi_gene_ids: List[int]) -> List[dict]:
        return tx.run(
            """
            UNWIND $ncbi_gene_ids AS node_id
            MATCH (g)-[:HAS_GENE]-(x:db_STRING)
            WHERE id(g)=node_id
            RETURN node_id, x.eid AS string_id, x.annotation AS annotation
            """,
            ncbi_gene_ids=ncbi_gene_ids
        ).data()

    def get_go_genes_query(self, tx: Neo4jTx, ncbi_gene_ids: List[int]) -> List[dict]:
        return tx.run(
            """
            UNWIND $ncbi_gene_ids AS node_id
            MATCH (g)-[:GO_LINK]-(x:db_GO)
            WHERE id(g)=node_id
            RETURN node_id, collect(x.name) AS go_terms
            """,
            ncbi_gene_ids=ncbi_gene_ids
        ).data()

    def get_biocyc_genes_query(self, tx: Neo4jTx, ncbi_gene_ids: List[int]) -> List[dict]:
        return tx.run(
            """
            UNWIND $ncbi_gene_ids AS node_id
            MATCH (g)-[:IS]-(x:db_BioCyc)
            WHERE id(g)=node_id
            RETURN node_id, x.pathways AS pathways, x.biocyc_id AS biocyc_id
            """,
            ncbi_gene_ids=ncbi_gene_ids
        ).data()

    def get_regulon_genes_query(self, tx: Neo4jTx, ncbi_gene_ids: List[int]) -> List[dict]:
        return tx.run(
            """
            UNWIND $ncbi_gene_ids AS node_id
            MATCH (g)-[:IS]-(x:db_RegulonDB)
            WHERE id(g)=node_id
            RETURN node_id, x AS node, x.regulondb_id AS regulondb_id
            """,
            ncbi_gene_ids=ncbi_gene_ids
        ).data()

    def get_kegg_genes_query(self, tx: Neo4jTx, ncbi_gene_ids: List[int]) -> List[dict]:
        return tx.run(
            """
            UNWIND $ncbi_gene_ids AS node_id
            MATCH (g)-[:IS]-(x:db_KEGG)
            WHERE id(g)=node_id
            WITH node_id, x
            MATCH (x)-[:HAS_KO]-()-[:IN_PATHWAY]-(p:Pathway)-[:HAS_PATHWAY]-(gen:Genome)
            WHERE gen.eid = x.genome
            RETURN node_id, x.eid AS kegg_id, collect(p.name) AS pathway
            """,
            ncbi_gene_ids=ncbi_gene_ids
        ).data()

    def get_three_hydroxisobuteric_acid_to_pykf_chebi_query(self, tx: Neo4jTx):
        return list(tx.run("""
            MATCH (chem:db_CHEBI:Chemical) WHERE chem.eid IN ['18064']
            WITH chem
            MATCH p=allShortestPaths((gene:db_EcoCyc:Gene {name:'pykF'})-[*..9]-(chem))
            WHERE none(r IN relationships(p) WHERE type(r) IN [
                'FUNCTION',
                'COMPONENT',
                'PROCESS',
                'HAS_TAXONOMY',
                'HAS_SYNONYM',
                'HAS_ROLE',
                'GO_LINK'
            ])
            RETURN [
                node IN nodes(p) |
                {
                    id: id(node),
                    name: node.name,
                    display_name: node.displayName,
                    labels: labels(node)
                }
            ] as nodes, [
                rel IN relationships(p) |
                {
                    id: id(rel),
                    type: type(rel),
                    start_node: id(startNode(rel)),
                    end_node: id(endNode(rel))
                }
            ] AS edges
            """))

    def get_three_hydroxisobuteric_acid_to_pykf_biocyc_query(self, tx: Neo4jTx):
        return list(tx.run("""
            MATCH (c:Compound {biocyc_id: 'CPD-12176'}), (g:Gene:db_BioCyc {name:'pykF'})
            MATCH p=allShortestPaths((c)-[*]-(g))
            WHERE none(r IN relationships(p)
            WHERE type(r) IN [
                'GO_LINK',
                'HAS_TAXONOMY',
                'HAS_SYNONYM',
                'REGULATES',
                'HAS_ROLE',
                'TYPE_OF'
            ])
            RETURN [
                node IN nodes(p) |
                {
                    id: id(node),
                    name: node.name,
                    display_name: node.displayName,
                    labels: labels(node)
                }
            ] as nodes, [
                rel IN relationships(p) |
                {
                    id: id(rel),
                    type: type(rel),
                    start_node: id(startNode(rel)),
                    end_node: id(endNode(rel))
                }
            ] AS edges
        """))

    def get_icd_to_rhse_query(self, tx: Neo4jTx):
        return list(tx.run("""
            MATCH p=allShortestPaths(
                (gene:db_EcoCyc:Gene {name:'icd'})-[*..13]-(gene2:db_EcoCyc:Gene {name:'rhsE'})
            )
            WHERE none(r IN relationships(p) WHERE type(r) IN ['HAS_TAXONOMY'])
            RETURN [
                node IN nodes(p) |
                {
                    id: id(node),
                    name: node.name,
                    display_name: node.displayName,
                    labels: labels(node)
                }
            ] as nodes, [
                rel IN relationships(p) |
                {
                    id: id(rel),
                    type: type(rel),
                    start_node: id(startNode(rel)),
                    end_node: id(endNode(rel))
                }
            ] AS edges
        """))

    def get_sirt5_to_nfe2l2_literature_query(self, tx: Neo4jTx):
        return list(tx.run("""
            MATCH (g:db_Literature:Gene {name:'SIRT5'})-[:HAS_TAXONOMY]->(t:Taxonomy {eid:'9606'}),
            (t)<-[:HAS_TAXONOMY]-(g2:db_Literature:Gene {name:'NFE2L2'})
            MATCH p=allShortestPaths((g)-[*]-(g2))
            WHERE all(rel IN relationships(p) WHERE type(rel) = 'ASSOCIATED')
            RETURN [
                node IN nodes(p) |
                {
                    id: id(node),
                    name: node.name,
                    display_name: node.displayName,
                    labels: labels(node)
                }
            ] as nodes, [
                rel IN relationships(p) |
                {
                    id: id(rel),
                    type: type(rel),
                    start_node: id(startNode(rel)),
                    end_node: id(endNode(rel))
                }
            ] AS edges
        """))

    def get_ctnnb1_to_diarrhea_literature_query(self, tx: Neo4jTx):
        return list(tx.run("""
            MATCH (g:db_Literature:Gene {name:'CTNNB1'})-[:HAS_TAXONOMY]->(t:Taxonomy {eid:'9606'})
            MATCH (d:Disease {name:'Diarrhea'})
            MATCH p=allShortestPaths((g)-[*]-(d))
            RETURN [
                node IN nodes(p) |
                {
                    id: id(node),
                    name: node.name,
                    display_name: node.displayName,
                    labels: labels(node)
                }
            ] as nodes, [
                rel IN relationships(p) |
                {
                    id: id(rel),
                    type: type(rel),
                    start_node: id(startNode(rel)),
                    end_node: id(endNode(rel))
                }
            ] AS edges
        """))

    def get_two_pathways_biocyc_query(self, tx: Neo4jTx):
        return list(tx.run("""
            MATCH (p1:Pathway {biocyc_id:'PWY-6151'}), (p2:Pathway {biocyc_id: 'PWY-6123'})
            WITH p1, p2
            MATCH p=allShortestPaths((p1)-[*]-(p2))
            WHERE NONE (r IN relationships(p) WHERE type(r) IN ['TYPE_OF'])
                AND NONE (n IN nodes(p) WHERE n.biocyc_id IN ['WATER','PROTON','Pi','ATP', 'ADP'])
            RETURN [
                node IN nodes(p) |
                {
                    id: id(node),
                    name: node.name,
                    display_name: node.displayName,
                    labels: labels(node)
                }
            ] as nodes, [
                rel IN relationships(p) |
                {
                    id: id(rel),
                    type: type(rel),
                    start_node: id(startNode(rel)),
                    end_node: id(endNode(rel))
                }
            ] AS edges
        """))

    def get_glycolisis_regulon_query(self, tx: Neo4jTx):
        return list(tx.run("""
            MATCH path=
                (:Pathway {biocyc_id: 'GLYCOLYSIS'})--(r:Reaction)--
                (e:EnzReaction:db_EcoCyc)-[:CATALYZES]-
                (:Protein)<-[:COMPONENT_OF*0..]-
                (:Protein)-[:ENCODES]-
                (:Gene:db_EcoCyc)-[:IS]-
                (:db_NCBI)-[:IS]-
                (g:db_RegulonDB)
            WITH path, g, r
            MATCH p1=(left)-[:CONSUMED_BY]->(r)-[:PRODUCES]->(right)
            OPTIONAL MATCH p2=(g)--(:TranscriptionUnit)--(:Promoter)-[:REGULATES]-(rg:Regulon)
            RETURN [
                node IN nodes(path) + nodes(p1) + nodes(p2) |
                {
                    id: id(node),
                    name: node.name,
                    display_name: node.displayName,
                    labels: labels(node)
                }
            ] as nodes, [
                rel IN relationships(path) + relationships(p1) + relationships(p2) |
                {
                    id: id(rel),
                    type: type(rel),
                    start_node: id(startNode(rel)),
                    end_node: id(endNode(rel))
                }
            ] AS edges
        """))
