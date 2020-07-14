from sqlalchemy.orm.session import Session
from sqlalchemy.sql.expression import and_

from typing import Dict, List

from neo4japp.services.common import RDBMSBaseDao
from neo4japp.models import OrganismGeneMatch


class OrganismGeneMatchService(RDBMSBaseDao):
    def __init__(self, session: Session):
        super().__init__(session)

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
