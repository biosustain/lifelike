"""New fallback_organism table to keep
track of fallback organisms associated with a file.

Revision ID: 64838825541f
Revises: 6cf8f5c54c9c
Create Date: 2020-10-20 22:10:59.597364

"""
from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '64838825541f'
down_revision = '6cf8f5c54c9c'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('fallback_organism',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('organism_name', sa.String(length=200), nullable=False),
    sa.Column('organism_synonym', sa.String(length=200), nullable=False),
    sa.Column('organism_taxonomy_id', sa.String(length=50), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_fallback_organism'))
    )
    op.add_column('files', sa.Column('fallback_organism_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_files_fallback_organism_id'), 'files', ['fallback_organism_id'], unique=False)
    op.create_foreign_key(op.f('fk_files_fallback_organism_id_fallback_organism'), 'files', 'fallback_organism', ['fallback_organism_id'], ['id'])
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(op.f('fk_files_fallback_organism_id_fallback_organism'), 'files', type_='foreignkey')
    op.drop_index(op.f('ix_files_fallback_organism_id'), table_name='files')
    op.drop_column('files', 'fallback_organism_id')
    op.drop_table('fallback_organism')
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    pass


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
