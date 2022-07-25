"""Add starred files table

Revision ID: a0fd1160db03
Revises: 93b75c6f3f87
Create Date: 2022-07-25 21:29:08.587451

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a0fd1160db03'
down_revision = '93b75c6f3f87'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'starred_file',
        sa.Column('creation_date', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('modified_date', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('file_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ['file_id'],
            ['files.id'],
            name=op.f('fk_starred_file_file_id_files'),
            ondelete='CASCADE'
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['appuser.id'],
            name=op.f('fk_starred_file_user_id_appuser'),
            ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_starred_file'))
    )
    op.create_index(op.f('ix_starred_file_file_id'), 'starred_file', ['file_id'], unique=False)
    op.create_index(op.f('ix_starred_file_user_id'), 'starred_file', ['user_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_starred_file_user_id'), table_name='starred_file')
    op.drop_index(op.f('ix_starred_file_file_id'), table_name='starred_file')
    op.drop_table('starred_file')
