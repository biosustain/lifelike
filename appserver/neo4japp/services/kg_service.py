from flask import current_app
import json
from neo4j import Transaction as Neo4jTx
import os

from neo4japp.services.common import HybridDBDao
from neo4japp.constants import ANNOTATION_STYLES_DICT, LogEventType
from neo4japp.utils.labels import get_first_known_label_from_list
from neo4japp.utils.logger import EventLog


class KgService(HybridDBDao):
    def __init__(self, graph, session):
        super().__init__(graph=graph, session=session)

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
