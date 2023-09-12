"""Fix broken `idHyperlink` property in old annotations

Revision ID: bd554f4c2b58
Revises: a1b5886ad7cb
Create Date: 2023-08-29 20:48:13.990798

"""
import attr
import hashlib
import html
import json
import sqlalchemy as sa

from alembic import context
from alembic import op
from enum import Enum
from io import BytesIO
from os import path
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session
from typing import List, Tuple

from migrations.utils import window_chunk


# revision identifiers, used by Alembic.
revision = 'bd554f4c2b58'
down_revision = 'a1b5886ad7cb'
branch_labels = None
depends_on = None
directory = path.realpath(path.dirname(__file__))

BATCH_SIZE = 1


class Enumd(Enum):
    @classmethod
    def get(cls, key, default=None):
        # Non-throwing value accessor modeled to behave like dict.get()
        try:
            return cls(key)
        except ValueError:
            return default


class EnrichmentDomain(Enumd):
    UNIPROT = 'UniProt'
    REGULON = 'Regulon'
    STRING = 'String'
    GO = 'GO'
    BIOCYC = 'BioCyc'


@attr.s(frozen=True)
class EnrichmentCellTextMapping:
    text: str = attr.ib()
    text_index_map: List[Tuple[int, dict]] = attr.ib()
    cell_texts: List[dict] = attr.ib()


t_files = sa.Table(
    'files',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('annotations', JSONB),
    sa.Column('enrichment_annotations', JSONB),
    sa.Column('content_id', sa.Integer()),
)

t_files_content = sa.Table(
    'files_content',
    sa.MetaData(),
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('raw_file', sa.LargeBinary()),
    sa.Column('checksum_sha256', sa.Binary()),
)


def fix_annotation_id_hyperlink(annotation):
    meta = annotation['meta']

    if 'idHyperlink' in meta:
        if 'idHyperlinks' not in meta:
            meta['idHyperlinks'] = []

        meta['idHyperlinks'].append(
            json.dumps({'label': meta['idType'], 'url': meta['idHyperlink']})
        )

        del meta['idHyperlink']

        return {**annotation, "meta": {**meta}}


def process_result_value(value):
    return list(map(fix_annotation_id_hyperlink, value))


def update_annotation_list(annotations):
    updated_annotations = process_result_value(annotations)
    if any(updated_annotations):
        return list(
            map(
                lambda zipped: zipped[1] or zipped[0],
                zip(annotations, updated_annotations),
            )
        )


def update_annotations(annotations):
    updated_annotations = update_annotation_list(annotations)
    if updated_annotations:
        return updated_annotations


def create_annotation_mappings(enrichment: dict):
    data = enrichment['result']

    total_index = 0
    cell_texts = []
    text_index_map = []
    combined_text = ''

    for i, gene in enumerate(data['genes']):
        if gene.get('matched', None) is None:
            # gene did not match so ignore and don't annotate
            continue

        try:
            cell_texts.append(
                {
                    'text': gene['imported'],
                    'index': i,
                    'domain': 'Imported',
                    'label': 'Imported',
                }
            )
            cell_texts.append(
                {
                    'text': gene['matched'],
                    'index': i,
                    'domain': 'Matched',
                    'label': 'Matched',
                }
            )
            cell_texts.append(
                {
                    'text': gene['fullName'],
                    'index': i,
                    'domain': 'Full Name',
                    'label': 'Full Name',
                }
            )

            if gene.get('domains'):
                for k, v in gene['domains'].items():
                    if k == EnrichmentDomain.REGULON.value:
                        for k2, v2 in v.items():
                            cell_texts.append(
                                {
                                    'text': v2['text'],
                                    'index': i,
                                    'domain': k,
                                    'label': k2,
                                }
                            )
                    elif k == EnrichmentDomain.BIOCYC.value:
                        cell_texts.append(
                            {
                                'text': v['Pathways']['text'],
                                'index': i,
                                'domain': k,
                                'label': 'Pathways',
                            }
                        )
                    elif (
                        k == EnrichmentDomain.GO.value
                        or k == EnrichmentDomain.STRING.value
                    ):
                        cell_texts.append(
                            {
                                'text': v['Annotation']['text'],
                                'index': i,
                                'domain': k,
                                'label': 'Annotation',
                            }
                        )
                    elif k == EnrichmentDomain.UNIPROT.value:
                        cell_texts.append(
                            {
                                'text': v['Function']['text'],
                                'index': i,
                                'domain': k,
                                'label': 'Function',
                            }
                        )
        except KeyError:
            print(
                f'\tMissing key when creating enrichment table text row/column mapping.'
            )
            continue

    for text in cell_texts:
        domain = EnrichmentDomain.get(text['domain'])
        if domain not in (EnrichmentDomain.GO, EnrichmentDomain.BIOCYC):
            combined_text += text['text']
            total_index = len(combined_text)
            text_index_map.append((total_index - 1, text))
            combined_text += ' '  # to separate prev text

    return EnrichmentCellTextMapping(
        text=combined_text, text_index_map=text_index_map, cell_texts=cell_texts
    )


def highlight_annotations(original_text: str, annotations: List[dict]):
    texts = []
    prev_ending_index = -1

    for annotation in annotations:
        meta = annotation['meta']
        meta_type = annotation['meta']['type']
        term = annotation['textInDocument']
        lo_location_offset = annotation['loLocationOffset']
        hi_location_offset = annotation['hiLocationOffset']

        text = (
            f'<annotation type="{meta_type}" meta="{html.escape(json.dumps(meta))}">'
            f'{term}'
            f'</annotation>'
        )

        if lo_location_offset == 0:
            prev_ending_index = hi_location_offset
            texts.append(text)
        else:
            if not texts:
                texts.append(original_text[:lo_location_offset])
                prev_ending_index = hi_location_offset
                texts.append(text)
            else:
                texts.append(original_text[prev_ending_index + 1 : lo_location_offset])
                prev_ending_index = hi_location_offset
                texts.append(text)

    texts.append(original_text[prev_ending_index + 1 :])
    final_text = ''.join(texts)
    return f'<snippet>{final_text}</snippet>'


def annotate_enrichment_table(
    annotations: List[dict],
    enriched: EnrichmentCellTextMapping,
    enrichment: dict,
):
    # sort by lo_location_offset to go from beginning to end
    sorted_annotations_list = sorted(annotations, key=lambda x: x['loLocationOffset'])

    prev_index = -1
    enriched_gene = ''

    for index, cell_text in enriched.text_index_map:
        annotation_chunk = [
            anno
            for anno in sorted_annotations_list
            if anno.get('hiLocationOffset', None)
            and anno.get('hiLocationOffset') <= index
        ]
        # it's sorted so we can do this to make the list shorter every iteration
        sorted_annotations_list = sorted_annotations_list[len(annotation_chunk) :]

        # update JSON to have enrichment row and domain...
        for anno in annotation_chunk:
            if prev_index != -1:
                # only do this for subsequent cells b/c
                # first cell will always have the correct index
                # update index offset to be relative to the cell again
                # since they're relative to the combined text
                anno['loLocationOffset'] = (
                    anno['loLocationOffset'] - (prev_index + 1) - 1
                )
                anno['hiLocationOffset'] = (
                    anno['loLocationOffset'] + anno['keywordLength'] - 1
                )

            if 'domain' in cell_text:
                # imported should come first for each row
                if cell_text['domain'] == 'Imported':
                    enriched_gene = cell_text['text']
                anno['enrichmentGene'] = enriched_gene
                if cell_text['domain'] == 'Regulon':
                    anno['enrichmentDomain']['domain'] = cell_text['domain']
                    anno['enrichmentDomain']['subDomain'] = cell_text['label']
                else:
                    anno['enrichmentDomain']['domain'] = cell_text['domain']

        snippet = highlight_annotations(
            original_text=cell_text['text'], annotations=annotation_chunk
        )
        enrichment_genes_index = enrichment['result']['genes'][cell_text['index']]
        if cell_text['domain'] == 'Imported':
            enrichment_genes_index['annotatedImported'] = snippet
        elif cell_text['domain'] == 'Matched':
            enrichment_genes_index['annotatedMatched'] = snippet
        elif cell_text['domain'] == 'Full Name':
            enrichment_genes_index['annotatedFullName'] = snippet
        else:
            enrichment_genes_index.get('domains').get(cell_text['domain']).get(
                cell_text['label']
            )['annotatedText'] = snippet

        prev_index = index

    return enrichment


def fix_enrichment_table_highlights(
    raw_file: bytes, annotations: List[dict]
) -> Tuple[bytes, dict]:
    enrichment = json.load(BytesIO(raw_file))
    enriched = create_annotation_mappings(enrichment)

    new_enrichment = annotate_enrichment_table(annotations, enriched, enrichment)

    print('\tWriting updated table data to bytes...')
    updated_file_fp = BytesIO()
    updated_file_fp.write(json.dumps(new_enrichment).encode())

    print('\tReturning from enrichment table validation...')
    return updated_file_fp.getvalue(), new_enrichment


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass


def data_upgrades():
    conn = op.get_bind()
    session = Session(conn)

    files = conn.execution_options(
        stream_results=True, max_row_buffer=BATCH_SIZE
    ).execute(
        sa.select(
            [
                t_files.c.id,
                t_files.c.annotations,
                t_files_content.c.id,
                t_files_content.c.raw_file,
            ]
        )
        .select_from(
            t_files_content.join(
                t_files,
                t_files.c.content_id == t_files_content.c.id,
            )
        )
        .order_by(t_files.c.id)
    )

    for chunk in window_chunk(files, BATCH_SIZE):
        for file_id, annotations_obj, content_id, raw_file in chunk:
            print(f'Processing File#{file_id}')
            # For some reason the annotations obj can be a string representing an empty array...
            if annotations_obj not in [[], '[]']:
                # Unfortunately some of our annotations are single element list objects. For the
                # migration not to fail we need to catch these and convert to the correct format.
                if type(annotations_obj) == list:
                    annotations_obj = annotations_obj[0]

                annotations_list = annotations_obj['documents'][0]['passages'][0][
                    'annotations'
                ]

                updated_annotations_list = update_annotations(annotations_list)
                if updated_annotations_list is not None:
                    (
                        updated_raw_file,
                        updated_enrichment_annotations,
                    ) = fix_enrichment_table_highlights(
                        raw_file, updated_annotations_list
                    )
                    new_hash = hashlib.sha256(updated_raw_file).digest()
                    annotations_obj['documents'][0]['passages'][0][
                        'annotations'
                    ] = updated_annotations_list

                    print(f'\tUpdating Files#{file_id}')
                    session.execute(
                        t_files.update()
                        .where(t_files.c.id == file_id)
                        .values(
                            annotations=annotations_obj,
                            enrichment_annotations=updated_enrichment_annotations,
                        )
                    )

                    print(f'\tUpdating FilesContent#{content_id}')
                    session.execute(
                        t_files_content.update()
                        .where(t_files_content.c.id == content_id)
                        .values(
                            id=content_id,
                            raw_file=updated_raw_file,
                            checksum_sha256=new_hash,
                        )
                    )
                    session.flush()
        session.commit()


def data_downgrades():
    pass
