from sqlalchemy.orm.session import Session
from sqlalchemy.sql.expression import and_

from typing import Dict, List

from neo4japp.services.common import RDBMSBaseDao
from neo4japp.models import OrganismGeneMatch


class AnnotationsNeo4jService(RDBMSBaseDao):
    """Allows access to the main Neo4jService. Separated due
    to being specific for annotations.
    """
    def __init__(
        self,
        session: Session,
        neo4j_service,
    ):
        super().__init__(session)
        self.neo4j = neo4j_service

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
        neo4j_result = self.neo4j.get_genes_to_organisms(second_round_genes, matched_organism_ids)

        # Join the results of the two queries
        postgres_result.update(neo4j_result)

        return postgres_result

    def get_organisms_from_ids(self, tax_ids: List[str]) -> List[str]:
        return self.neo4j.get_organisms_from_ids(tax_ids)
