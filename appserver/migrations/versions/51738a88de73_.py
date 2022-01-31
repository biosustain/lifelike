"""Drop FallbackOrganism table and migrate data to Files

Revision ID: 51738a88de73
Revises: cf9f210458c8
Create Date: 2022-01-14 22:33:40.360405

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column

from migrations.utils import window_chunk
from neo4japp.models import Files


# revision identifiers, used by Alembic.
revision = '51738a88de73'
down_revision = 'cf9f210458c8'
branch_labels = None
depends_on = None

ck_files_fallback_organism_null_consistent = """
    (
        (organism_name IS NULL) AND
        (organism_synonym IS NULL) AND
        (organism_taxonomy_id IS NULL)
    ) OR (
        (organism_name IS NOT NULL) AND
        (organism_synonym IS NOT NULL) AND
        (organism_taxonomy_id IS NOT NULL)
    )
"""


def upgrade():
    # Add the new columns
    op.add_column('files', sa.Column('organism_name', sa.String(length=200), nullable=True))
    op.add_column('files', sa.Column('organism_synonym', sa.String(length=200), nullable=True))
    op.add_column('files', sa.Column('organism_taxonomy_id', sa.String(length=50), nullable=True))
    op.create_check_constraint(
        constraint_name='ck_files_fallback_organism_null_consistent',
        table_name='files',
        condition=ck_files_fallback_organism_null_consistent
    )

    # Then migrate the data from FallbackOrganism into Files
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()

    # Finally drop the old columns and FallbackOrganism table
    op.drop_index('ix_files_fallback_organism_id', table_name='files')
    op.drop_constraint('fk_files_fallback_organism_id_fallback_organism',
                       'files', type_='foreignkey')
    op.drop_column('files', 'fallback_organism_id')

    op.drop_table('fallback_organism')


def downgrade():
    # Re-create the FallackOrganism table
    op.create_table(
        'fallback_organism',
        sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column('organism_name', sa.VARCHAR(length=200), autoincrement=False, nullable=False),
        sa.Column('organism_synonym',
                  sa.VARCHAR(length=200), autoincrement=False, nullable=False),
        sa.Column('organism_taxonomy_id',
                  sa.VARCHAR(length=50), autoincrement=False, nullable=False),
        sa.PrimaryKeyConstraint('id', name='pk_fallback_organism')
    )

    # Re-create the foreign key constraint on the Files table
    op.add_column(
        'files',
        sa.Column('fallback_organism_id', sa.INTEGER(), autoincrement=False, nullable=True))
    op.create_foreign_key('fk_files_fallback_organism_id_fallback_organism',
                          'files', 'fallback_organism', ['fallback_organism_id'], ['id'])
    op.create_index('ix_files_fallback_organism_id',
                    'files', ['fallback_organism_id'], unique=False)

    # Migrate the data from Files back into FallbackOrganism (TODO when necessary)
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_downgrades()

    # Finally drop the columns from Files, as well as the CHECK constraint
    op.drop_constraint('ck_files_fallback_organism_null_consistent', 'files', 'check')
    op.drop_column('files', 'organism_taxonomy_id')
    op.drop_column('files', 'organism_synonym')
    op.drop_column('files', 'organism_name')


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)

    files_table_clause = table(
        'files',
        column('id', sa.Integer),
        column('fallback_organism_id', sa.Integer))

    fallback_organism_table_clause = table(
        'fallback_organism',
        column('id', sa.Integer),
        column('organism_name', sa.String),
        column('organism_synonym', sa.String),
        column('organism_taxonomy_id', sa.String))

    files = conn.execution_options(stream_results=True).execute(sa.select([
        files_table_clause.c.id,
        fallback_organism_table_clause.c.organism_name,
        fallback_organism_table_clause.c.organism_synonym,
        fallback_organism_table_clause.c.organism_taxonomy_id
    ]).where(
        files_table_clause.c.fallback_organism_id == fallback_organism_table_clause.c.id)
    )

    for chunk in window_chunk(files, 25):
        files_to_update = []
        for fid, organism_name, organism_synonym, organism_taxonomy_id in chunk:
            files_to_update.append({
                'id': fid,
                'organism_name': organism_name,
                'organism_synonym': organism_synonym,
                'organism_taxonomy_id': organism_taxonomy_id
            })

        try:
            session.bulk_update_mappings(Files, files_to_update)
            session.commit()
        except Exception:
            raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
