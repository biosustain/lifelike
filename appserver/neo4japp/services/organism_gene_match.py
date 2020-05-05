from sqlalchemy import func
from sqlalchemy.orm.session import Session

from typing import Dict, List

from neo4japp.services.common import RDBMSBaseDao
from neo4japp.models import OrganismGeneMatch


class OrganismGeneMatchService(RDBMSBaseDao):
    def __init__(self, session: Session):
        super().__init__(session)

    def get_genes(
        self,
        genes: List[str],
    ) -> Dict[str, str]:
        gene_map: Dict[str, str] = dict()

        result = self.session.query(
            func.lower(OrganismGeneMatch.gene_name),
            OrganismGeneMatch.gene_id,
        ).filter(
            func.lower(OrganismGeneMatch.synonym).in_(genes),
        )

        for row in result:
            gene_name: str = row[0]
            gene_id: str = row[1]
            gene_map[gene_name] = gene_id

        return gene_map
