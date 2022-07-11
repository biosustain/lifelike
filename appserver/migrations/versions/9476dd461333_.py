"""Update all enrichment tables to v6 of schema

Revision ID: 9476dd461333
Revises: 93b75c6f3f87
Create Date: 2022-06-09 20:53:49.869308

"""
from alembic import context, op
import hashlib
import json
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session

from migrations.utils import window_chunk

from neo4japp.constants import FILE_MIME_TYPE_ENRICHMENT_TABLE
from neo4japp.models.files import FileContent, Files
from neo4japp.schemas.formats.enrichment_tables import validate_enrichment_table


# revision identifiers, used by Alembic.
revision = '9476dd461333'
down_revision = '93b75c6f3f87'
branch_labels = None
depends_on = None


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass


DEFAULT_DOMAIN_INFO = {
    "Regulon": {
        "labels": [
            "Regulator Family",
            "Activated By",
            "Repressed By"
        ]
    },
    "UniProt": {
        "labels": [
            "Function"
        ]
    },
    "String": {
        "labels": [
            "Annotation"
        ]
    },
    "GO": {
        "labels": [
            "Annotation"
        ]
    },
    "BioCyc": {
        "labels": [
            "Pathways"
        ]
    }
}

ORGANISM_MAP = {
    '511145': 'Escherichia coli str. K-12 substr. MG1655',
    '9606': 'Homo sapiens'
}


def _fix_str_annos(annos):
    genes, tax_id, organism, sources = annos.split('/')
    sources = sources.split(',')

    if tax_id and organism == '':
        organism = ORGANISM_MAP[tax_id]

    if 'Biocyc' in sources:
        sources[sources.index('Biocyc')] = 'BioCyc'

    return {
        'data': {
            'genes': genes,
            'taxId': tax_id,
            'sources': sources,
            'organism': organism
        },
        'result': {
            'genes': [{'imported': gene} for gene in genes],
            'domainInfo': DEFAULT_DOMAIN_INFO
        }
    }


def _fix_annos_based_on_error(enrichment_annos: dict, error: str):
    if error == "data.result must not contain {'version'} properties":
        enrichment_annos['result'].pop('version')
    elif error == "data must contain ['data'] properties":
        # Remove and cache 'genes' and 'domainInfo' from the object
        genes = enrichment_annos.pop('genes')
        domain_info = enrichment_annos.pop('domain_info')

        # Make sure the domains have the proper casing
        for gene in genes:
            if 'domains' in gene and 'Biocyc' in gene['domains']:
                gene['domains']['BioCyc'] = gene['domains'].pop('Biocyc')
            if 'annotated_imported' in gene:
                gene['annotatedImported'] = gene.pop('annotated_imported')
            if 'annotated_full_name' in gene:
                gene['annotatedFullName'] = gene.pop('annotated_full_name')
            if 'annotated_matched' in gene:
                gene['annotatedMatched'] = gene.pop('annotated_matched')
            if 'full_name' in gene:
                gene['fullName'] = gene.pop('full_name')

        if 'Biocyc' in domain_info:
            domain_info['BioCyc'] = domain_info.pop('Biocyc')

        # Check if 'version' is a property and remove it
        if 'version' in enrichment_annos:
            enrichment_annos.pop('version')

        # Synthesize the 'data' and 'result' properties from the old props
        enrichment_annos['data'] = {
            'genes': ','.join([gene['imported'] for gene in genes]),
            'taxId': '511145',
            'sources': ['UniProt', 'String', 'GO', 'BioCyc', 'KEGG'],
            'organism': 'Escherichia coli str. K-12 substr. MG1655'
        }
        enrichment_annos['result'] = {'genes': genes, 'domainInfo': domain_info}
    elif error == 'data must be object' or error == 'data.data must be object':
        # Remove and cache 'genes' and 'domainInfo' from the 'result' object
        genes = enrichment_annos['result'].pop('genes')
        domain_info = enrichment_annos['result'].pop('domainInfo')

        # Make sure the domains have the proper casing
        for gene in genes:
            if 'domains' in gene and 'Biocyc' in gene['domains']:
                gene['domains']['BioCyc'] = gene['domains'].pop('Biocyc')
            if 'annotated_imported' in gene:
                gene['annotatedImported'] = gene.pop('annotated_imported')
            if 'annotated_full_name' in gene:
                gene['annotatedFullName'] = gene.pop('annotated_full_name')
            if 'annotated_matched' in gene:
                gene['annotatedMatched'] = gene.pop('annotated_matched')
            if 'full_name' in gene:
                gene['fullName'] = gene.pop('full_name')

        if 'Biocyc' in domain_info:
            domain_info['BioCyc'] = domain_info.pop('Biocyc')

        # Set final 'result' object
        enrichment_annos['result'] = {'genes': genes, 'domainInfo': domain_info}

        # Next make sure 'data' object has correct schema
        genes, tax_id, organism, sources = enrichment_annos['data'].split('/')
        sources = sources.split(',')

        if 'Biocyc' in sources:
            sources[sources.index('Biocyc')] = 'BioCyc'

        # Set final 'data' object
        enrichment_annos['data'] = {
            'genes': genes,
            'taxId': tax_id,
            'sources': sources,
            'organism': organism
        }
    return enrichment_annos


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)

    t_files = sa.table(
        'files',
        sa.column('id', sa.Integer),
        sa.column('content_id', sa.Integer),
        sa.column('mime_type', sa.String),
        sa.column('enrichment_annotations', postgresql.JSONB)
    )

    t_files_content = sa.table(
        'files_content',
        sa.column('id', sa.Integer),
        sa.column('raw_file', sa.LargeBinary),
        sa.column('checksum_sha256', sa.Binary)
    )

    # This will retrieve all enrichment tables that *have* annotations. The annotations and the
    # content *might* be invalid. If the annotations are invalid, we will fix them and then
    # replace the content with them.
    files = conn.execution_options(stream_results=True).execute(
        sa.select([
            t_files.c.id,
            t_files.c.content_id,
            t_files.c.enrichment_annotations
        ]).where(
            sa.and_(
                t_files.c.mime_type == FILE_MIME_TYPE_ENRICHMENT_TABLE,
                t_files.c.enrichment_annotations.isnot(None),
            )
        )
    )

    # This will retrieve the *content* of all enrichment tables *without* annotations. If the
    # content is invalid, we will fix it, and update the row with the valid content.
    files_content = conn.execution_options(stream_results=True).execute(
        sa.select([
            t_files_content.c.id,
            t_files_content.c.raw_file,
        ]).select_from(
            t_files_content.join(
                t_files,
                sa.and_(
                    t_files.c.content_id == t_files_content.c.id,
                    t_files.c.mime_type == FILE_MIME_TYPE_ENRICHMENT_TABLE,
                    t_files.c.enrichment_annotations.is_(None),
                )
            )
        )
    )

    for chunk in window_chunk(files_content, 10):
        file_content_to_update = []
        for id, raw in chunk:
            try:
                decoded_raw = raw.decode('utf-8')
                enrichment_annos = json.loads(decoded_raw)
                validate_enrichment_table(enrichment_annos)
            except json.JSONDecodeError:
                if type(decoded_raw) == str:
                    enrichment_annos = _fix_str_annos(decoded_raw)
            except Exception as e:
                enrichment_annos = _fix_annos_based_on_error(enrichment_annos, str(e))

            # At this point, all schema issues should be resolved
            validate_enrichment_table(enrichment_annos)

            # Add the FileContent update mapping to the list
            new_content = json.dumps(enrichment_annos, separators=(',', ':')).encode('utf-8')
            new_hash = hashlib.sha256(new_content).digest()
            file_content_to_update.append({'id': id, 'raw_file': new_content, 'checksum_sha256': new_hash})  # noqa

        session.bulk_update_mappings(FileContent, file_content_to_update)
        session.commit()

    unique_content_map = {}
    for chunk in window_chunk(files, 10):
        files_to_update = []
        file_content_to_update = []
        for id, content_id, enrichment_annos in chunk:
            # For some reason, despite filtering these rows out in the query above, we're still
            # getting results with null enrichment annotations
            if enrichment_annos is None:
                continue
            try:
                validate_enrichment_table(enrichment_annos)
            except Exception as e:
                enrichment_annos = _fix_annos_based_on_error(enrichment_annos, str(e))

                # At this point, all schema issues should be resolved
                validate_enrichment_table(enrichment_annos)

                # Do the same for FileContent, i.e., if the enrichment annotations were
                # invalid, the raw content is too since they're more or less the same
                new_content = json.dumps(enrichment_annos, separators=(',', ':')).encode('utf-8')
                new_hash = hashlib.sha256(new_content).digest()

                existing_content = conn.execute(
                    sa.select([
                        t_files_content.c.id,
                    ]).where(
                        t_files_content.c.checksum_sha256 == new_hash,
                    )
                ).scalar()

                file_content_id = existing_content
                # If it's not a duplicate of an existing file content...
                if existing_content is None:
                    # And it's not a duplicate of a newly fixed file...
                    if new_hash not in unique_content_map:
                        unique_content_map[new_hash] = content_id
                        file_content_to_update.append({'id': content_id, 'raw_file': new_content, 'checksum_sha256': new_hash})  # noqa
                    file_content_id = unique_content_map[new_hash]
                files_to_update.append({'id': id, 'enrichment_annotations': enrichment_annos, 'content_id': file_content_id})  # noqa

        session.bulk_update_mappings(Files, files_to_update)
        session.bulk_update_mappings(FileContent, file_content_to_update)
        session.commit()


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
