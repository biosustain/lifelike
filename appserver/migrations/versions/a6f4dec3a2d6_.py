"""Update old annotations to have new
UUID field.

Revision ID: a6f4dec3a2d6
Revises: fb1654973fbd
Create Date: 2020-08-20 17:53:35.156357

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column
from sqlalchemy.dialects import postgresql

from uuid import uuid4


# revision identifiers, used by Alembic.
revision = 'a6f4dec3a2d6'
down_revision = 'fb1654973fbd'
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

    files_table = table(
        'files',
        column('id', sa.Integer),
        column('annotations', postgresql.JSONB))

    files = session.execute(sa.select([
        files_table.c.id,
        files_table.c.annotations
    ])).fetchall()

    try:
        for f in files:
            fix = False
            annotations_list = f.annotations['documents'][0]['passages'][0]['annotations']
            for annotation in annotations_list:
                if annotation.get('uuid', None) is None:
                    # if one doesn't have uuid then
                    # rest shouldn't have either
                    fix = True
                    break

            if fix:
                updated_annotations = []
                for annotation in annotations_list:
                    updated_annotations.append({
                        **annotation,
                        'uuid': str(uuid4()),
                    })

                f.annotations['documents'][0]['passages'][0]['annotations'] = updated_annotations
                session.execute(
                    files_table.update().where(
                        files_table.c.id == f.id).values(annotations=f.annotations)
                )
        session.commit()
    except Exception:
        session.rollback()
        session.close()


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
