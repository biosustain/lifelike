"""Update old enrichment table JSON to have new properties annotated_imported, annotated_full_name, annotated_matched.

Revision ID: 819554a9fcf3
Revises: 2ceb4c0d1d9e
Create Date: 2021-03-25 18:31:45.379794

"""
from alembic import context
from alembic import op
import sqlalchemy as sa

import re

from sqlalchemy.sql import table, column, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm.session import Session

from migrations.utils import window_chunk

# flake8: noqa: OIG001 # It is legacy file with imports from appserver which we decided to not fix
from neo4japp.models import Files

# revision identifiers, used by Alembic.
revision = '819554a9fcf3'
down_revision = '2ceb4c0d1d9e'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)
    pass


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)

    tableclause = table(
        'files',
        column('id', sa.Integer),
        column('enrichment_annotations', postgresql.JSONB),
        column('mime_type', sa.String),
    )

    files = conn.execution_options(stream_results=True).execute(
        sa.select([tableclause.c.id, tableclause.c.enrichment_annotations]).where(
            sa.and_(
                tableclause.c.mime_type == 'vnd.lifelike.document/enrichment-table',
                tableclause.c.enrichment_annotations.isnot(None),
            )
        )
    )

    for chunk in window_chunk(files, 25):
        collected = []
        for fid, annotations in chunk:
            annotations['version'] = '3'
            updated_genes = []
            for gene in annotations['genes']:
                if 'full_name' not in gene:
                    updated_genes.append(gene)
                    # means gene was not matched
                    continue

                if 'annotation' in gene['imported']:
                    name = re.findall(
                        r'<annotation.*?>(.*?)</annotation>', gene['imported']
                    )[0]
                else:
                    name = re.findall(r'<snippet>(.*?)</snippet>', gene['imported'])[0]
                gene['annotated_imported'] = gene['imported']
                gene['imported'] = name

                if 'annotation' in gene['matched']:
                    name = re.findall(
                        r'<annotation.*?>(.*?)</annotation>', gene['matched']
                    )[0]
                else:
                    name = re.findall(r'<snippet>(.*?)</snippet>', gene['matched'])[0]
                gene['annotated_matched'] = gene['matched']
                gene['matched'] = name

                # can't do the above for this, because can be multi-word
                # which can have multiple <snippet><annotation>... alongside
                # text without those tags
                # best is to just set to whatever is in fullName
                # then when enrich data is refreshed, it will update correctly
                gene['annotated_full_name'] = gene['full_name']
                updated_genes.append(gene)
            annotations['genes'] = updated_genes
            collected.append({'id': fid, 'enrichment_annotations': annotations})
        try:
            session.bulk_update_mappings(Files, collected)
            session.commit()
        except Exception:
            session.rollback()
            raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
