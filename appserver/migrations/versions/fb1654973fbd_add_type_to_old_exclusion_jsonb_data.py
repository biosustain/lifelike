"""Add type to old exclusion JSONB data

Revision ID: fb1654973fbd
Revises: 10c15d47e7c6
Create Date: 2020-08-07 20:55:46.926012
i
"""
from alembic import context
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column
from sqlalchemy.sql.expression import not_

from neo4japp.database import db
from neo4japp.models import Files

# revision identifiers, used by Alembic.
revision = 'fb1654973fbd'
down_revision = '10c15d47e7c6'
branch_labels = None
depends_on = None


def upgrade():
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    pass
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    session = Session(op.get_bind())

    val = db.column('value', type_=JSONB)
    files = session.query(
        Files,
    ).select_from(
        Files,
        db.func.jsonb_array_elements(Files.excluded_annotations).alias()
    ).filter(
        not_(val.has_key('type'))  # noqa
    ).distinct().all()

    try:
        for file in files:
            exclusions_to_update = []
            exclusions_to_update_ids = []
            exclusions_to_keep = []

            for exclusion in file.excluded_annotations:
                if exclusion.get('type', None) is None:
                    exclusions_to_update.append(exclusion)
                    exclusions_to_update_ids.append(exclusion['id'])
                else:
                    exclusions_to_keep.append(exclusion)

            id_type_map = {}
            for annotation in file.annotations['documents'][0]['passages'][0]['annotations']:
                if annotation['meta']['id'] in exclusions_to_update_ids:
                    id_type_map[annotation['meta']['id']] = annotation['meta']['type']

            updated_exclusions = []
            for exclusion in exclusions_to_update:
                updated_exclusions.append({
                    **exclusion,
                    # Very uncommon case, but for whatever reason there are exclusions that have no
                    # corresponding annotation, so we have to give a default value in those cases.
                    'type': id_type_map.get(exclusion['id'], 'Unknown')
                })

            file.excluded_annotations = [*updated_exclusions, *exclusions_to_keep]

        session.commit()
    except Exception:
        session.rollback()
        session.close()
        raise

    session.close()


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
