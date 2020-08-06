"""Migrate the annotations JSON with old `keyword_type`
attribute to the new `type` one. This is to align with
the pdf-viewer.

Revision ID: 10c15d47e7c6
Revises: e89e52d63fca
Create Date: 2020-08-06 18:57:56.419375

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm.session import Session

from neo4japp.models import Files


# revision identifiers, used by Alembic.
revision = '10c15d47e7c6'
down_revision = 'e89e52d63fca'
branch_labels = None
depends_on = None


def upgrade():
    # pass to data_upgrades()
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

    updated = []
    files = session.query(Files.id, Files.annotations).all()

    for f in files:
        fix = False
        annotations_list = f.annotations['documents'][0]['passages'][0]['annotations']
        for annotation in annotations_list:
            if annotation['meta'].get('keywordType'):
                fix = True
                break

        if fix:
            updated_annotations = []
            for annotation in annotations_list:
                entity_type = annotation['meta']['keywordType']
                del annotation['meta']['keywordType']
                annotation['meta']['type'] = entity_type
                updated_annotations.append(annotation)

            f.annotations['documents'][0]['passages'][0]['annotations'] = updated_annotations
            updated.append(
                {
                    'id': f.id,
                    'annotations': f.annotations,
                }
            )

        if len(updated) == 50:
            session.bulk_update_mappings(Files, updated)
            session.commit()
            updated = []



def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
