"""Update annotation related JSON to have idHyperlinks as a list to allow multiple source links

Revision ID: d75017512d42
Revises: ba94cdb023f4
Create Date: 2021-08-12 15:53:55.446163

"""
import json
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from sqlalchemy.sql import table, column, and_, or_
from sqlalchemy.orm.session import Session

from urllib.parse import urlparse

from migrations.utils import window_chunk

# flake8: noqa: OIG001 # It is legacy file with imports from appserver which we decided to not fix
from neo4japp.constants import FILE_MIME_TYPE_ENRICHMENT_TABLE, FILE_MIME_TYPE_PDF
from neo4japp.models import Files

# revision identifiers, used by Alembic.
revision = 'd75017512d42'
down_revision = 'ba94cdb023f4'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    pass
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)

    tableclause1 = table(
        'files',
        column('id', sa.Integer),
        column('mime_type', sa.String),
        column('annotations', postgresql.JSONB),
        column('excluded_annotations', postgresql.JSONB),
        column('custom_annotations', postgresql.JSONB),
    )

    files = conn.execution_options(stream_results=True).execute(
        sa.select([tableclause1.c.id, tableclause1.c.annotations]).where(
            and_(
                or_(
                    tableclause1.c.mime_type == FILE_MIME_TYPE_ENRICHMENT_TABLE,
                    tableclause1.c.mime_type == FILE_MIME_TYPE_PDF,
                ),
                tableclause1.c.annotations != '[]',
            )
        )
    )

    for chunk in window_chunk(files, 15):
        files_to_update = []
        for fid, annotations_json in chunk:
            try:
                annotations = annotations_json['documents'][0]['passages'][0][
                    'annotations'
                ]
            except Exception:
                # for keyerrors and
                # some reason still getting annotations_json == '[]'
                # for stage db...
                continue
            else:
                for anno in annotations:
                    if anno['meta'].get('idHyperlink', '') == '':
                        anno['meta']['idHyperlinks'] = []
                    else:
                        link = anno['meta']['idHyperlink']
                        label = urlparse(link).netloc.replace('www.', '')
                        anno['meta']['idHyperlinks'] = [
                            json.dumps({'label': label, 'url': link})
                        ]
                    anno['meta'].pop('idHyperlink')

                annotations_json['documents'][0]['passages'][0][
                    'annotations'
                ] = annotations
                files_to_update.append({'id': fid, 'annotations': annotations_json})
        try:
            session.bulk_update_mappings(Files, files_to_update)
            session.commit()
        except Exception:
            raise

    # custom annotations

    files = conn.execution_options(stream_results=True).execute(
        sa.select([tableclause1.c.id, tableclause1.c.custom_annotations]).where(
            and_(
                tableclause1.c.mime_type == FILE_MIME_TYPE_PDF,
                tableclause1.c.custom_annotations != '[]',
            )
        )
    )

    for chunk in window_chunk(files, 15):
        files_to_update = []
        for fid, custom_annotations in chunk:
            for custom in custom_annotations:
                if custom['meta'].get('idHyperlink', '') == '':
                    custom['meta']['idHyperlinks'] = []
                else:
                    if custom['meta']['idType'] == 'None':
                        custom['meta']['idType'] = ''
                    link = custom['meta']['idHyperlink']
                    label = urlparse(link).netloc.replace('www.', '')
                    custom['meta']['idHyperlinks'] = [
                        json.dumps({'label': label, 'url': link})
                    ]
                try:
                    custom['meta'].pop('idHyperlink')
                except KeyError:
                    pass
            files_to_update.append(
                {'id': fid, 'custom_annotations': custom_annotations}
            )
        try:
            session.bulk_update_mappings(Files, files_to_update)
            session.commit()
        except Exception:
            raise

    # excluded annotations

    files = conn.execution_options(stream_results=True).execute(
        sa.select([tableclause1.c.id, tableclause1.c.excluded_annotations]).where(
            and_(
                tableclause1.c.mime_type == FILE_MIME_TYPE_PDF,
                tableclause1.c.excluded_annotations != '[]',
            )
        )
    )

    for chunk in window_chunk(files, 15):
        files_to_update = []
        for fid, excluded_annotations in chunk:
            for excluded in excluded_annotations:
                if excluded.get('idHyperlink', '') == '':
                    excluded['idHyperlinks'] = []
                else:
                    link = excluded['idHyperlink']
                    label = urlparse(link).netloc.replace('www.', '')
                    excluded['idHyperlinks'] = [
                        json.dumps({'label': label, 'url': link})
                    ]

                try:
                    excluded.pop('idHyperlink')
                except KeyError:
                    pass
            files_to_update.append(
                {'id': fid, 'excluded_annotations': excluded_annotations}
            )
        try:
            session.bulk_update_mappings(Files, files_to_update)
            session.commit()
        except Exception:
            raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
