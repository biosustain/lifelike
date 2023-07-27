"""Creating vector and vectorizer for drawing tool map

Revision ID: a84e5653318c
Revises: 7998c4d9f557
Create Date: 2020-04-23 11:51:00.436591

"""
from pathlib import Path
from alembic import context
from alembic import op
import sqlalchemy as sa
import sqlalchemy_utils
from sqlalchemy_searchable import sync_trigger
from sqlalchemy.orm import sessionmaker
from sqlalchemy_searchable import vectorizer
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision = 'a84e5653318c'
down_revision = '7998c4d9f557'
branch_labels = None
depends_on = None

Session = sessionmaker()


def run_sqlalchemy_searchable_sql():
    """
    With alembic and sqlalchemy_searchable we run SQL statements before table creation.
    These statements enable searching
    See:
    - https://conorliv.com/alembic-migration-execute-raw-sql.html
    - https://github.com/kvesteri/sqlalchemy-searchable/issues/67
    """
    sql_expressions = (
        Path('migrations').joinpath('searchable_expressions.sql').open().read()
    )
    bind = op.get_bind()
    session = Session(bind=bind)
    session.execute(sql_expressions)


def upgrade():
    run_sqlalchemy_searchable_sql()
    # ### commands auto generated by Alembic - please adjust! ###
    vectorizer.clear()
    conn = op.get_bind()
    op.add_column(
        'project',
        sa.Column('search_vector', sqlalchemy_utils.types.TSVectorType, nullable=True),
    )
    op.create_index(
        'ix_project_search_vector',
        'project',
        ['search_vector'],
        unique=False,
        postgresql_using='gin',
    )

    metadata = sa.MetaData(bind=conn)
    project = sa.Table('project', metadata, autoload=True)

    @vectorizer(project.c.graph)
    def json_vectorizer(column):
        return sa.cast(sa.func.json2text(column), sa.Text)

    sync_trigger(
        conn, 'project', 'search_vector', ['label', 'graph'], metadata=metadata
    )
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index('ix_project_search_vector', table_name='project')
    op.drop_column('project', 'search_vector')
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
