import os

directory = os.path.realpath(os.path.dirname(__file__))

# Indexing constants
FILE_INDEX_ID = 'file'
FILE_INDEX_DEFINITION_PATH = os.path.join(directory, './mappings/document_idx.json')
ATTACHMENT_PIPELINE_ID = 'attachment'
ATTACHMENT_PIPELINE_DEFINITION_PATH = os.path.join(
    directory,
    './pipelines/attachments_pipeline.json'
)

ELASTIC_INDEX_SEED_PAIRS = [
    (FILE_INDEX_ID, FILE_INDEX_DEFINITION_PATH),
]
ELASTIC_PIPELINE_SEED_PAIRS = [
    (ATTACHMENT_PIPELINE_ID, ATTACHMENT_PIPELINE_DEFINITION_PATH),
]

# Search constants
FRAGMENT_SIZE = 2147483647
WILDCARD_MIN_LEN = 3
