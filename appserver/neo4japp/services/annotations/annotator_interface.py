import asyncio

from flask import current_app

from neo4japp.services.rabbitmq import send


def send_pdf_annotation_request(
    file_id: int,
    global_exclusions: list,
    local_exclusions: list,
    local_inclusions: list,
    organism_synonym: str,
    organism_taxonomy_id: str,
    override_annotation_configs: dict
):
    current_app.logger.info(f'Sending annotation task for PDF with id: {file_id}')
    _send_annotation_request(
        file_id=file_id,
        global_exclusions=global_exclusions,
        local_exclusions=local_exclusions,
        local_inclusions=local_inclusions,
        organism_synonym=organism_synonym,
        organism_taxonomy_id=organism_taxonomy_id,
        override_annotation_config=override_annotation_configs
    )


def send_et_annotation_request(
    file_id: int,
    enrichment_mapping: dict,
    raw_enrichment_data: dict,
    global_exclusions: list,
    local_exclusions: list,
    local_inclusions: list,
    organism_synonym: str,
    organism_taxonomy_id: str,
    override_annotation_configs: dict
):
    current_app.logger.info(f'Sending annotation task for enrichment table with id: {file_id}')
    _send_annotation_request(
        file_id=file_id,
        enrichment_mapping=enrichment_mapping,
        raw_enrichment_data=raw_enrichment_data,
        global_exclusions=global_exclusions,
        local_exclusions=local_exclusions,
        local_inclusions=local_inclusions,
        organism_synonym=organism_synonym,
        organism_taxonomy_id=organism_taxonomy_id,
        override_annotation_configs=override_annotation_configs,
    )


def _send_annotation_request(**kwargs):
    current_app.logger.debug(kwargs)
    asyncio.run(
        send(
            body=kwargs,
            queue=current_app.config.get('ANNOTATOR_QUEUE')
        )
    )
