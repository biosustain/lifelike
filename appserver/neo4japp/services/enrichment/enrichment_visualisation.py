import logging
from typing import List

from neo4japp.services import KgService

logging.getLogger("py2neo.client.bolt").setLevel(logging.INFO)


class EnrichmentVisualisationService(KgService):
    def __init__(self, graph, session):
        super().__init__(graph=graph, session=session)

    def enrich_go(self, gene_names: List[str], analysis, organism):
        if analysis == 'fisher':
            from neo4japp.services.enrichment.enrich_methods import fisher
            return fisher(gene_names, self.get_GO_terms(organism))
        elif analysis == 'binomial':
            from neo4japp.services.enrichment.enrich_methods import binomial
            return binomial(gene_names, self.get_GO_terms(organism))

    def get_GO_terms(self, organism):
        try:
            id, name = organism.split('/')
            return self.graph.run(
                """
                MATCH (:Taxonomy {id:$id,name:$name})-
                       [:HAS_TAXONOMY]-(n:Gene)-[:GO_LINK]-(g:db_GO)
                WITH n, g, labels(g) AS go_labels
                RETURN
                    n.id AS geneId, n.name AS geneName, g.id AS goId, g.name AS goTerm,
                    [lbl IN go_labels WHERE lbl<> 'db_GO'] AS goLabel
                LIMIT 35000
                """,
                id=id,
                name=name
            ).data()
        except Exception as e:
            print(e)
            import json
            data = {}
            with open('./neo4japp/services/enrichment/go.json') as json_file:
                data = json.load(json_file)
            return data

    def get_GO_significance(self, gene_names, organism):
        id, name = organism.split('/')
        data = self.graph.run(
            """
            match (:Taxonomy {id:$id, name:$name})-[tl:HAS_TAXONOMY]-(n:Gene)-[nl:GO_LINK]-(g:db_GO)
            where n.name in $gene_names
            return n.name as gene, count(nl) as n_related_GO_terms
            limit 1000
            """,
            id=id,
            name=name,
            gene_names=gene_names
        ).data()
        return data
