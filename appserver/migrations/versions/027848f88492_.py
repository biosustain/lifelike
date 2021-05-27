"""empty message

Revision ID: 027848f88492
Revises: bc9d080502da
Create Date: 2021-05-27 11:15:23.903830

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '027848f88492'
down_revision = 'bc9d080502da'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # op.alter_column('access_control_policy', 'action',
    #            existing_type=sa.VARCHAR(length=50),
    #            type_=sa.Enum('READ', 'WRITE', name='accessactiontype'),
    #            existing_nullable=False)
    op.add_column('appuser', sa.Column('failed_login_count', sa.Integer(), nullable=False))
    # op.alter_column('file_annotations_version', 'cause',
    #            existing_type=postgresql.ENUM('USER', 'USER_REANNOTATION', 'SYSTEM_REANNOTATION', name='annotationcause'),
    #            type_=sa.Enum('USER', 'USER_REANNOTATION', 'SYSTEM_REANNOTATION', name='annotationchangecause'),
    #            existing_nullable=False)
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # op.alter_column('file_annotations_version', 'cause',
    #            existing_type=sa.Enum('USER', 'USER_REANNOTATION', 'SYSTEM_REANNOTATION', name='annotationchangecause'),
    #            type_=postgresql.ENUM('USER', 'USER_REANNOTATION', 'SYSTEM_REANNOTATION', name='annotationcause'),
    #            existing_nullable=False)
    op.drop_column('appuser', 'failed_login_count')
    # op.alter_column('access_control_policy', 'action',
    #            existing_type=sa.Enum('READ', 'WRITE', name='accessactiontype'),
    #            type_=sa.VARCHAR(length=50),
    #            existing_nullable=False)
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
