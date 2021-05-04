from enrichment import EnrichmentVisualisationService

def get_enrichment_visualisation_service():
    if 'enrichment_visualisation_service' not in g:
        from neo4japp.services import EnrichmentVisualisationService
        graph = get_neo4j_db()
        g.enrichment_visualisation_service = EnrichmentVisualisationService(
            graph=graph,
            session=db.session,
        )
    return g.enrichment_visualisation_service
