"""Add copyright infringement request table

Revision ID: b49193a949a6
Revises: 6b7a2da00472
Create Date: 2022-02-01 00:41:36.600878

"""
from alembic import context
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b49193a949a6'
down_revision = '6b7a2da00472'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('copyright_infringement_request',
    sa.Column('creation_date', sa.TIMESTAMP(timezone=True), nullable=False),
    sa.Column('modified_date', sa.TIMESTAMP(timezone=True), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('url', sa.String(length=256), nullable=False),
    sa.Column('description', sa.String(length=1000), nullable=False),
    sa.Column('name', sa.String(length=256), nullable=False),
    sa.Column('company', sa.String(length=256), nullable=False),
    sa.Column('address', sa.String(length=256), nullable=False),
    sa.Column('country', sa.String(length=256), nullable=False),
    sa.Column('city', sa.String(length=256), nullable=False),
    sa.Column('province', sa.String(length=256), nullable=False),
    sa.Column('zip', sa.String(length=256), nullable=False),
    sa.Column('phone', sa.String(length=256), nullable=False),
    sa.Column('fax', sa.String(length=256), nullable=True),
    sa.Column('email', sa.String(length=256), nullable=False),
    sa.Column('attestationCheck1', sa.Boolean(), nullable=False),
    sa.Column('attestationCheck2', sa.Boolean(), nullable=False),
    sa.Column('attestationCheck3', sa.Boolean(), nullable=False),
    sa.Column('attestationCheck4', sa.Boolean(), nullable=False),
    sa.Column('signature', sa.String(length=256), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_copyright_infringement_request'))
    )

    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    op.drop_table('copyright_infringement_request')


def data_upgrades():
    """Add optional data upgrade migrations here"""
    pass


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
