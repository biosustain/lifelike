"""Validate all files in the database

Revision ID: eb9ab3ce66ee
Revises: bd554f4c2b58
Create Date: 2023-08-25 18:24:24.062840

"""
import bioc
import fastjsonschema
import hashlib
import json
import sqlalchemy as sa
import zipfile

from alembic import context
from alembic import op
from bioc.biocjson import fromJSON as biocFromJSON
from io import BytesIO
from jsonlines import Reader as BioCJsonIterReader
from os import path
from pdfminer import high_level
from pdfminer.pdfdocument import PDFEncryptionError
from sqlalchemy.orm import Session

from migrations.utils import window_chunk

# revision identifiers, used by Alembic.
revision = 'eb9ab3ce66ee'
down_revision = 'bd554f4c2b58'
branch_labels = None
depends_on = None
directory = path.realpath(path.dirname(__file__))

BATCH_SIZE = 1
FILE_MIME_TYPE_DIRECTORY = 'vnd.lifelike.filesystem/directory'
FILE_MIME_TYPE_PDF = 'application/pdf'
FILE_MIME_TYPE_BIOC = 'vnd.lifelike.document/bioc'
FILE_MIME_TYPE_MAP = 'vnd.lifelike.document/map'
FILE_MIME_TYPE_GRAPH = 'vnd.lifelike.document/graph'
FILE_MIME_TYPE_ENRICHMENT_TABLE = 'vnd.lifelike.document/enrichment-table'
KNOWN_DOMAINS = {
    'biocyc': 'BioCyc',
    'go': 'GO',
    'kegg': 'KEGG',
    'regulon': 'Regulon',
    'string': 'String',
    'uniprot': 'UniProt',
}

t_files = sa.Table(
    'files',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('mime_type'),
    sa.Column('content_id', sa.VARCHAR()),
)

t_files_content = sa.Table(
    'files_content',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('raw_file', sa.LargeBinary()),
    sa.Column('checksum_sha256', sa.Binary()),
)


def _validate_directory(buffer):
    # Figure out file size
    size = buffer.size

    if size > 0:
        raise ValueError("Directories can't have content")


def _validate_pdf(buffer):
    with buffer as bufferView:
        # Check that the pdf is considered openable
        try:
            high_level.extract_text(bufferView, page_numbers=[0], caching=False)
        except PDFEncryptionError as e:
            raise Exception(
                title='Failed to Read PDF',
                message='This pdf is locked and cannot be loaded into Lifelike.',
            ) from e
        except Exception as e:
            raise Exception(
                title='Failed to Read PDF',
                message='An error occurred while reading this pdf.'
                ' Please check if the pdf is unlocked and openable.',
            ) from e


def _validate_bioc(buffer):
    with BioCJsonIterReader(buffer) as reader:
        for obj in reader:
            passage = biocFromJSON(obj, level=bioc.DOCUMENT)


def _validate_map(buffer):
    # noinspection PyTypeChecker
    with open(path.join(directory, '../upgrade_data/map_v3.json'), 'r') as f:
        # Use this method to validate the content of map
        validate_map = fastjsonschema.compile(json.load(f))

    with buffer as bufferView:
        try:
            with zipfile.ZipFile(bufferView) as zip_file:
                # Test zip returns the name of the first invalid file inside the archive; if any
                if zip_file.testzip():
                    raise ValueError
                json_graph = json.loads(zip_file.read('graph.json'))
                validate_map(json_graph)
                for node in json_graph['nodes']:
                    if node.get('image_id'):
                        zip_file.read(
                            ''.join(['images/', node.get('image_id'), '.png'])
                        )
        except (zipfile.BadZipFile, KeyError):
            raise ValueError


def _validate_sankey(buffer):
    # noinspection PyTypeChecker
    with open(path.join(directory, '../upgrade_data/graph_v6.json'), 'r') as f:
        # Use this method to validate the content of a sankey
        validate_graph_format = fastjsonschema.compile(json.load(f))

    with buffer as bufferView:
        data = json.loads(bufferView.read())
        validate_graph_format(data)


def _validate_enrichment_table(buffer):
    # Use this method to validate the content of an enrichment table
    # noinspection PyTypeChecker
    with open(
        path.join(directory, '../upgrade_data/enrichment_tables_v6.json'), 'r'
    ) as f:
        validate_enrichment_table = fastjsonschema.compile(json.load(f))

    with buffer as bufferView:
        data = json.loads(bufferView.read())
        validate_enrichment_table(data)


def _validate_file(mime_type: str, raw_file: bytes):
    if mime_type == FILE_MIME_TYPE_DIRECTORY:
        _validate_directory(BytesIO(raw_file))
    elif mime_type == FILE_MIME_TYPE_PDF:
        _validate_pdf(BytesIO(raw_file))
    elif mime_type == FILE_MIME_TYPE_BIOC:
        _validate_bioc(BytesIO(raw_file))
    elif mime_type == FILE_MIME_TYPE_MAP:
        _validate_map(BytesIO(raw_file))
    elif mime_type == FILE_MIME_TYPE_GRAPH:
        _validate_sankey(BytesIO(raw_file))
    elif mime_type == FILE_MIME_TYPE_ENRICHMENT_TABLE:
        _validate_enrichment_table(BytesIO(raw_file))
    else:
        return


def _fix_invalid_enrichment_table(raw_file: bytes) -> bytes:
    updated_file_fp = BytesIO()

    try:
        json_data = json.load(BytesIO(raw_file))

        print('\tFixing file with dict format...')

        genes, tax_id, organism, sources = json_data['data'].split('/')
        sources = sources.split(',')
        result = json_data['result']

        print('\tFixing spelling in data sources...')
        # Fix invalid spelling in data sources
        for i, source in enumerate(sources):
            normalized_source = source.lower()
            if normalized_source in KNOWN_DOMAINS:
                sources[i] = KNOWN_DOMAINS[normalized_source]

        print('\tFixing spelling in domainInfo...')
        # Fix invalid spelling in result domainInfo
        for domain in list(result['domainInfo'].keys()):
            normalized_domain = domain.lower()

            if normalized_domain in KNOWN_DOMAINS:
                correct_domain = KNOWN_DOMAINS[normalized_domain]
                result['domainInfo'][correct_domain] = result['domainInfo'][domain]
                result['domainInfo'].pop(domain)

        # Result should not have a 'version' property
        result.pop('version')

        # Fix invalid spelling in result genes domains
        for gene in result['genes']:
            if 'domains' in gene:
                for domain in list(gene['domains'].keys()):
                    normalized_domain = domain.lower()

                    if normalized_domain in KNOWN_DOMAINS:
                        correct_domain = KNOWN_DOMAINS[normalized_domain]
                        gene['domains'][correct_domain] = gene['domains'][domain]
                        gene['domains'].pop(domain)

        new_json_data = {
            'data': {
                'genes': genes,
                'taxId': tax_id,
                'organism': organism,
                'sources': sources,
            },
            'result': json_data['result'],
        }

        print('\tWriting updated table data to bytes...')
        updated_file_fp.write(json.dumps(new_json_data).encode())
    except json.decoder.JSONDecodeError:
        print('\tFixing file with str format...')

        # If json decoding failed, it's probably because the raw file was a simple string
        data = BytesIO(raw_file).getvalue().decode()
        genes, tax_id, organism, sources = data.split('/')
        sources = sources.split(',')

        # Fix invalid spelling in data sources
        for i, source in enumerate(sources):
            normalized_source = source.lower()
            if normalized_source in KNOWN_DOMAINS:
                sources[i] = KNOWN_DOMAINS[normalized_source]

        new_json_data = {
            'data': {
                'genes': genes,
                'taxId': tax_id,
                'organism': organism,
                'sources': sources,
            },
            'result': {'domainInfo': dict(), 'genes': []},
        }

        print('\tWriting updated table data to bytes...')
        updated_file_fp.write(json.dumps(new_json_data).encode())

    print('\tReturning from enrichment table validation...')
    return updated_file_fp.getvalue()


def _fix_invalid_pdf(raw_file: bytes) -> bytes:
    with open('pdf_file_check', 'wb') as pdf_fp:
        pdf_fp.write(raw_file)

        text = raw_file.decode().strip()

        if text[:15] == '<!DOCTYPE html>':
            print('\tFixing file incorrectly labeled as pdf: file is actually html')
            return raw_file, 'text/html'

    return raw_file, 'application/pdf'


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass


def data_upgrades():
    conn = op.get_bind()
    session = Session(conn)

    query = (
        sa.select(
            [t_files_content.c.id, t_files_content.c.raw_file, t_files.c.mime_type]
        )
        .select_from(
            t_files_content.join(
                t_files,
                t_files.c.content_id == t_files_content.c.id,
            )
        )
        .group_by(t_files_content.c.id, t_files_content.c.raw_file, t_files.c.mime_type)
        .order_by(t_files_content.c.id)
    )

    data = conn.execution_options(
        stream_results=True, max_row_buffer=BATCH_SIZE
    ).execute(query)

    for chunk in window_chunk(data, BATCH_SIZE):
        for content_id, raw_file, mime_type in chunk:
            print(f'Validating FilesContent#{content_id}: {mime_type}')

            try:
                _validate_file(mime_type, raw_file)
            except:
                print('\tFile is invalid, attempting to update...')
                updated_mime_type = mime_type
                if mime_type == FILE_MIME_TYPE_ENRICHMENT_TABLE:
                    updated_file = _fix_invalid_enrichment_table((raw_file))
                elif mime_type == FILE_MIME_TYPE_PDF:
                    updated_file, updated_mime_type = _fix_invalid_pdf(raw_file)
                else:
                    # We don't have a method for fixing this file, so skip it
                    continue

                print('\tFile updated, validating again...')
                _validate_file(updated_mime_type, updated_file)
                print('\tValidation success!')

                new_hash = hashlib.sha256(updated_file).digest()

                print(f'\tUpdating FilesContent#{content_id}')

                # If the mime type was recalculated, the any files using this content should be
                # updated
                session.execute(
                    t_files.update()
                    .where(t_files.c.content_id == content_id)
                    .values(
                        mime_type=updated_mime_type,
                    )
                )

                # Update the file content with the new data and checksum
                session.execute(
                    t_files_content.update()
                    .where(t_files_content.c.id == content_id)
                    .values(
                        id=content_id, raw_file=updated_file, checksum_sha256=new_hash
                    )
                )
                session.flush()
        session.commit()


def data_downgrades():
    pass
