from sqlalchemy.orm.session import Session
from sqlalchemy.sql.expression import and_

from typing import Dict, List

from py2neo import Graph

from neo4japp.services import KgService
from neo4japp.models import OrganismGeneMatch


class AnnotationsNeo4jService(KgService):
    """KG service specific to annotations."""
    def __init__(
        self,
        session: Session,
        graph: Graph,
    ):
        super().__init__(session=session, graph=graph)

    def get_genes(
        self,
        genes: List[str],
        organism_ids: List[str]
    ) -> Dict[str, Dict[str, str]]:

        result = self.session.query(
            OrganismGeneMatch.gene_name,
            OrganismGeneMatch.gene_id,
            OrganismGeneMatch.taxonomy_id,
        ).filter(
            and_(
                OrganismGeneMatch.synonym.in_(genes),
                OrganismGeneMatch.taxonomy_id.in_(organism_ids),
            )
        )

        gene_to_organism_map: Dict[str, Dict[str, str]] = dict()
        for row in result:
            gene_name: str = row[0]
            gene_id: str = row[1]
            organism_id = row[2]

            # If an organism has multiple genes with the same name, we save the one appearing last
            # in the result set. Currently no way of identifying which should be returned, however
            # we might change this in the future.
            if gene_to_organism_map.get(gene_name, None) is not None:
                gene_to_organism_map[gene_name][organism_id] = gene_id
            else:
                gene_to_organism_map[gene_name] = {organism_id: gene_id}

        return gene_to_organism_map

    def get_gene_to_organism_match_result(
        self,
        genes: List[str],
        matched_organism_ids: List[str],
    ) -> Dict[str, Dict[str, str]]:
        """Returns a map of gene name to gene id."""
        # First check if the gene/organism match exists in the postgres lookup table
        postgres_result = self.get_genes(genes, matched_organism_ids)

        # Collect all the genes that were not matched to an organism in the table, and search
        # the Neo4j database for them
        second_round_genes = [gene for gene in genes if gene not in postgres_result.keys()]
        neo4j_result = self.get_genes_to_organisms(second_round_genes, matched_organism_ids)

        # Join the results of the two queries
        postgres_result.update(neo4j_result)

        return postgres_result

    def get_genes_to_organisms(
        self,
        genes: List[str],
        organisms: List[str],
    ) -> Dict[str, Dict[str, str]]:
        gene_to_organism_map: Dict[str, Dict[str, str]] = dict()

        query = self.get_gene_to_organism_query()
        result = self.graph.run(
            query,
            {
                'genes': genes,
                'organisms': organisms,
            }
        ).data()

        for row in result:
            gene_name: str = row['gene']
            organism_id: str = row['organism_id']
            # For now just get the first gene in the list of matches, no way for us to infer which
            # to use
            gene_id: str = row['gene_ids'][0]

            if gene_to_organism_map.get(gene_name, None) is not None:
                gene_to_organism_map[gene_name][organism_id] = gene_id
            else:
                gene_to_organism_map[gene_name] = {organism_id: gene_id}

        return gene_to_organism_map

    def get_organisms_from_tax_ids(self, tax_ids: List[str]) -> List[str]:
        query = self.get_taxonomy_from_synonyms_query()
        result = self.graph.run(query, {'ids': tax_ids}).data()

        return [row['organism_id'] for row in result]

    def get_organisms_from_gene_ids(self, gene_ids: List[str]):
        query = self.get_organisms_from_gene_ids_query()
        result = self.graph.run(
            query, {
                'gene_ids': gene_ids
            }
        ).data()
        return result

    def get_gene_to_organism_query(self):
        """Retrieves a list of all the genes with a given name
        in a particular organism."""
        query = """
            MATCH (s:Synonym)-[]-(g:Gene)
            WHERE s.name IN $genes
            WITH s, g MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)-[:HAS_PARENT*0..2]->(p)
            WHERE p.id IN $organisms
            RETURN s.name AS gene, collect(g.id) AS gene_ids, p.id AS organism_id
        """
        return query

    def get_taxonomy_from_synonyms_query(self):
        """Retrieves a list of all taxonomy with a given taxonomy id.
        """
        query = """
            MATCH (t:Taxonomy) WHERE t.id IN $ids RETURN t.id as organism_id
        """
        return query

    def get_organisms_from_gene_ids_query(self):
        """Retrieves a list of gene and corresponding organism data
        from a given list of genes."""
        query = """
            MATCH (g:Gene) WHERE g.id IN $gene_ids
            WITH g
            MATCH (g)-[:HAS_TAXONOMY]-(t:Taxonomy)
            RETURN g.id AS gene_id, g.name as gene_name, t.id as taxonomy_id, t.name as species_name
        """
        return query
