from sqlalchemy.sql.expression import and_

from typing import Dict, List

from neo4japp.database import DBConnection
from neo4japp.models import OrganismGeneMatch


class AnnotationDBService(DBConnection):
    def get_genes(
        self,
        genes: List[str],
        organism_ids: List[str]
    ) -> Dict[str, Dict[str, Dict[str, str]]]:
        result = self.session.query(
            OrganismGeneMatch.gene_name,
            OrganismGeneMatch.synonym,
            OrganismGeneMatch.gene_id,
            OrganismGeneMatch.taxonomy_id,
        ).filter(
            and_(
                OrganismGeneMatch.synonym.in_(genes),
                OrganismGeneMatch.taxonomy_id.in_(organism_ids),
            )
        )

        gene_to_organism_map: Dict[str, Dict[str, Dict[str, str]]] = {}
        for row in result:
            gene_name: str = row[0]
            gene_synonym: str = row[1]
            gene_id: str = row[2]
            organism_id: str = row[3]

            if gene_to_organism_map.get(gene_synonym, None) is not None:
                if gene_to_organism_map[gene_synonym].get(gene_name, None):
                    gene_to_organism_map[gene_synonym][gene_name][organism_id] = gene_id
                else:
                    gene_to_organism_map[gene_synonym][gene_name] = {organism_id: gene_id}
            else:
                gene_to_organism_map[gene_synonym] = {gene_name: {organism_id: gene_id}}

        return gene_to_organism_map
