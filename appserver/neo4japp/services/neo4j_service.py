import attr

from typing import Any, Dict, List, Union, Optional

from flask import json
from py2neo import NodeMatcher, RelationshipMatcher

from neo4japp.services.common import BaseDao
from neo4japp.models import GraphNode, GraphRelationship
from neo4japp.constants import *

from neo4japp.util import CamelDictMixin, compute_hash
from neo4japp.services.common import BaseDao

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
class Neo4jNodeMapping(CamelDictMixin):
    mapped_node_type: str = attr.ib()
    mapped_node_property_to: str = attr.ib()
    mapped_node_property_from: Dict[int, str] = attr.ib(default=attr.Factory(dict))
    node_type: Optional[str] = attr.ib(default=None)
    node_properties: Dict[int, str] = attr.ib(default=attr.Factory(dict))
    # this will be used to match a node
    unique_property: Optional[str] = attr.ib(default=None)
    edge: Optional[str] = attr.ib(default=None)


@attr.s(frozen=True)
class Neo4jRelationshipMapping(CamelDictMixin):
    edge: Dict[int, str] = attr.ib()
    source_node: Neo4jNodeMapping = attr.ib()
    target_node: Neo4jNodeMapping = attr.ib()
    edge_property: Dict[int, str] = attr.ib(default=attr.Factory(dict))


@attr.s(frozen=True)
class Neo4jColumnMapping(CamelDictMixin):
    """The int values are the column index
    from the excel files."""
    domain: str = attr.ib()
    file_name: str = attr.ib()
    sheet_name: str = attr.ib()
    new_nodes: List[Neo4jNodeMapping] = attr.ib(default=attr.Factory(list))
    existing_nodes: List[Neo4jNodeMapping] = attr.ib(default=attr.Factory(list))
    relationships: List[Neo4jRelationshipMapping] = attr.ib(default=attr.Factory(list))


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
        print(records)
        node_dict = dict()
        rel_dict = dict()
        for record in records:
            nodes = record['nodes']
            rels = record['relationships']
            for node in nodes:
                graph_node = GraphNode.from_py2neo(node)
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

    def expand_graph(self, node_id: str):
        query = self.get_expand_query(node_id)
        return self._query_neo4j(query)

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
            match (n)-[l]-(s) WHERE ID(n) = {}
            WITH n, s, l
            LIMIT {}
            return collect(n) + collect(s) as nodes, collect(l) as relationships
        """.format(node_id, limit)
        print(query)
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

    def save_node_to_neo4j(self, node_mappings) -> None:
        # print(column_mappings)
        print(node_mappings)
        # node_mappings = self.create_node_mapping(column_mappings)

        tx = self.graph.begin()
        # node_hash_map = dict()

        # import IPython; IPython.embed()

        # create the experimental nodes



        # TODO: consider switching back to py2neo OGM...
        # might be easier because dynamic values make raw ciphers hard...
        # TODO: create index on unique_property
        # TODO: handle exception where match nodes but property is different (check JIRA)
        domain_name = node_mappings['new_nodes'][0]['domain']    # just get the first domain because they'll be the same for newly created nodes (?)
        # tx.run(f'merge (d:`{domain_name}` {{name: "{domain_name}"}})')
        # # tx.run(f'create constraint unique_domain_name on (d:`{domain_name}`) assert d.name is unique')
        # # tx.commit()
        # # tx.run(f'create index on :`{domain_name}`(name)')
        # # tx.commit()
        domain_node = self.graph.nodes.match(domain_name, **{'name': domain_name}).first()
        if not domain_node:
            domain_node = Node(domain_name, **{'name': domain_name})
            tx.create(domain_node)

        # tx = self.graph.begin()

        for node in node_mappings['new_nodes']:
            # can't use cipher parameters due to the dynamic map keys in filtering
            # e.g merge (n:TYPE {map...})
            # neo4j guy: https://stackoverflow.com/a/28784921
            node_type = node['node_type']
            mapped_node_prop = node['mapped_node_prop']
            mapped_node_prop_value = node['mapped_node_prop_value']
            KG_mapped_node_prop = node['KG_mapped_node_prop']
            node_properties = node['node_properties']
            KG_mapped_node_type = node['KG_mapped_node_type']
            edge = node['edge']

            filter_property = {mapped_node_prop: mapped_node_prop_value}
            KG_filter_property = {KG_mapped_node_prop: mapped_node_prop_value}

            # user experimental data node
            exp_node = self.graph.nodes.match(node_type, **filter_property).first()

            if exp_node:
                # TODO: check if node properties match incoming node_properties
                # also do in frontend - keep set of values from unique column
                # if see again, check if node_properties are different
                # if not, throw exception to let user know (check JIRA issue)
                continue
            else:
                exp_node = Node(node_type, **node_properties)
                tx.create(exp_node)

            # create relationship between user experiemental data node with
            # domain node
            relationship = Relationship(domain_node, 'CONTAINS', exp_node, **{})
            tx.create(relationship)

            # create relationship between user experiemental data node with
            # existing nodes in knowledge graph
            if KG_mapped_node_type:
                kg_node = self.graph.nodes.match(KG_mapped_node_type, **KG_filter_property).first()
                if kg_node:
                    relationship = Relationship(exp_node, edge, kg_node, **{})
                    tx.create(relationship)

            # query = f'merge (n:`{node_type}` {{`{mapped_node_prop}`: '
            # # neo4j requires quotes around string property value
            # # but no quote if an int type
            # if type(mapped_node_prop_value) is str:
            #     query += f'"{mapped_node_prop_value}"}}) '
            # else:
            #     query += f'{mapped_node_prop_value}}}) '
            # query += f'on create set n += {{'

            # # need to do this because neo4j doesn't allow quotes for the property keys
            # for k, v in node_properties.items():
            #     if type(v) is str:
            #         query += f'{k}: "{v}", '
            #     else:
            #         query += f'{k}: {v}, '
            # # remove the comma and white space after last property
            # query = query[:-2] + f'}} with n '
            # query += f'match (universal:`{KG_mapped_node_type}` {{`{KG_mapped_node_prop}`: '

            # if type(mapped_node_prop_value) is str:
            #     query += f'"{mapped_node_prop_value}"}}), (d:`{domain_name}` {{name: "{domain_name}"}}) '
            # else:
            #     query += f'{mapped_node_prop_value}}}), (d:`{domain_name}` {{name: "{domain_name}"}}) '
            # query += f'merge (n)-[:{edge}]->(universal) '
            # query += f'merge (d)-[:CONTAINS]->(n)'

            # tx.run(query)

        # can't use cipher parameters due to the dynamic map keys in filtering
        # e.g merge (n:TYPE {map...})
        # neo4j guy: https://stackoverflow.com/a/28784921
        # need to use APOC because the node properties are dynamic
        # tx.run(
        #     'unwind {batches} as batch ' \
        #     'call apoc.merge.node([batch.node_type], row.unique_property, row.data, row.data) ' \
        #     'yield node ' \
        #     'return count(*)',
        #     {'batches': node_mappings}
        # )

        # import IPython; IPython.embed()

        # print('Done creating nodes')

        # create relationship from experimental nodes
        # to universal source nodes
        # for row in node_mapping['nodes']:
        #     filter_label = next(iter(row['unique_property']))
        #     filter_prop = next(iter(row['unique_property'].values()))
        #     row_label = row['label']

        #     query = f'match (universal:`{column_mappings.node.mapped_node_type}` {{`{filter_label}`: "{filter_prop}"}}), '
        #     query += f'(src:`{row_label}` {{`{filter_label}`: "{filter_prop}"}}) '
        #     query += f'merge (src)-[:IS_A]->(universal)'
        #     tx.run(query)

        # import IPython; IPython.embed()


        print('Done creating relationship of new nodes to existing KG')

        # import IPython; IPython.embed()


        # # create index on all properties
        # # have to do this here because can't have same transaction
        # # TODO: Jira KG-51
        # for row in node_mapping['nodes']:
        #     label = row['label']
        #     for k, _ in row['data'].items():
        #         tx.run(f'create index on :{label}({k})')
        # if column_mappings.relationship.edge:
        #     self.save_relationship_to_neo4j(column_mappings)
        if node_mappings['relationships']:
            self.save_relationship_to_neo4j(tx, node_mappings)
        else:
            tx.commit()
        print('Done')

    def save_relationship_to_neo4j(
        self,
        tx: Transaction,
        node_mappings,  # TODO: create attrs class (in importer service)
    ) -> None:
        for relation in node_mappings['relationships']:
            # relationships.append({
            #         'source_node_label': source_node_label,
            #         'source_node_prop_label': source_node_prop_label,
            #         'source_node_prop_value': source_node_prop_value,
            #         'target_node_label': target_node_label,
            #         'target_node_prop_label': target_node_prop_label,
            #         'target_node_prop_value': target_node_prop_value,
            #         'edge': edge_label,
            #     })
            source_node_label = relation['source_node_label']
            source_node_prop_label = relation['source_node_prop_label']
            source_node_prop_value = relation['source_node_prop_value']
            target_node_label = relation['target_node_label']
            target_node_prop_label = relation['target_node_prop_label']
            target_node_prop_value = relation['target_node_prop_value']
            edge_label = relation['edge_label']

            # source_filter_property = {source_node_prop_label: source_node_prop_value}
            # TODO: need to use node_properties here because the filter
            # might not be unique - see importer service for additional notes
            source_filter_property = relation['source_node_properties']
            target_filter_property = {target_node_prop_label: target_node_prop_value}

            # TODO: if nodes not found throw exception or create?
            source_node = self.graph.nodes.match(source_node_label, **source_filter_property).first()
            if source_node:
                target_node = self.graph.nodes.match(target_node_label, **target_filter_property).first()
                if target_node:
                    # TODO: the **{} should be edge properties
                    tx.create(Relationship(source_node, edge_label, target_node, **{}))




        # workbook = cache.get(column_mappings.file_name)

        # col_idx_src_node_prop = {}
        # col_idx_tgt_node_prop = {}
        # col_idx_edge_prop = {}

        # for k, v in column_mappings.relationship.source_node.mapped_node_property.items():
        #     col_idx_src_node_prop[int(k)] = v

        # for k, v in column_mappings.relationship.target_node.mapped_node_property.items():
        #     col_idx_tgt_node_prop[int(k)] = v

        # for k, v in column_mappings.relationship.edge_property.items():
        #     col_idx_edge_prop[int(k)] = v

        # for i, name in enumerate(workbook.sheetnames):
        #     if name == column_mappings.sheet_name:
        #         workbook.active = i
        #         break

        # current_ws = workbook.active

        # tx = self.graph.begin()

        # for row in current_ws.iter_rows(
        #     min_row=2,
        #     max_row=len(list(current_ws.rows)),
        #     max_col=len(list(current_ws.columns)),
        #     values_only=True,
        # ):
        #     if not all(cell is None for cell in row):
        #         # TODO: handle null otherwise strip() and lstrip() fails
        #         src_label = column_mappings.relationship.source_node.mapped_node_type
        #         # try:
        #         src_prop_label = next(iter(col_idx_src_node_prop.values()))
        #         src_prop_value = row[next(iter(col_idx_src_node_prop))]
        #         if type(src_prop_value) is str:
        #             src_prop_value = f'"{src_prop_value.strip().lstrip()}"'

        #         tgt_label = column_mappings.relationship.target_node.mapped_node_type
        #         tgt_prop_label = next(iter(col_idx_tgt_node_prop.values()))
        #         tgt_prop_value = row[next(iter(col_idx_tgt_node_prop))]
        #         if type(tgt_prop_value) is str:
        #             tgt_prop_value = f'"{tgt_prop_value.strip().lstrip()}"'

        #         # TODO: instead of using column header
        #         # use column values for edge
        #         edge_label = column_mappings.relationship.edge

        #         query = f'match (s:`{src_label}` {{`{src_prop_label}`: {src_prop_value}}}), '
        #         query += f'(t:`{tgt_label}` {{`{tgt_prop_label}`: {tgt_prop_value}}}) '

        #         query += f'merge (s)-[:`{edge_label}`'
        #         if col_idx_edge_prop:
        #             query += f'{{'
        #             for k, v in col_idx_edge_prop.items():
        #                 prop_value = row[k]
        #                 if type(prop_value) is int:
        #                     query += f'`{v}`: {prop_value}, '
        #                 else:
        #                     query += f'`{v}`: "{prop_value}", '
        #             # remove the comma at the end
        #             query = query[:-2] + f'}}'
        #         query += f']->(t)'
        #         print(query)
        #         tx.run(query)
        #         # except AttributeError:
        #             # if this occur then the cell in the row
        #             # was empty so strip() and lstrip() failed
        #             # skip and don't create the relationship
        #             # continue
        tx.commit()
        print('Done creating relationships between new nodes')
