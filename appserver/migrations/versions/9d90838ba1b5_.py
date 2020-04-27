"""Create projects table since project was taken

Revision ID: 9d90838ba1b5
Revises: ca616cde5e21
Create Date: 2020-04-16 13:07:58.992563

"""
from alembic import context
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9d90838ba1b5'
down_revision = 'ca616cde5e21'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_name', sa.String(length=250), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('creation_date', sa.DateTime(), nullable=True),
        sa.Column('users', sa.ARRAY(sa.Integer()), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_projects')),
        sa.UniqueConstraint('project_name', name=op.f('uq_projects_project_name'))
    )
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('projects')
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
