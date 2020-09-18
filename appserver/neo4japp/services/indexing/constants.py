FILE_INDEX_ID = 'file'
FILE_INDEX_DEFINITION_PATH = '/home/n4j/neo4japp/services/indexing/mappings/document_idx.json'
ATTACHMENT_PIPELINE_ID = 'attachment'
ATTACHMENT_PIPELINE_DEFINITION_PATH = '/home/n4j/neo4japp/services/indexing/pipelines/attachments_pipeline.json'  # noqa

ELASTIC_INDEX_SEED_PAIRS = [
    (FILE_INDEX_ID, FILE_INDEX_DEFINITION_PATH),
]
ELASTIC_PIPELINE_SEED_PAIRS = [
    (ATTACHMENT_PIPELINE_ID, ATTACHMENT_PIPELINE_DEFINITION_PATH),
]
