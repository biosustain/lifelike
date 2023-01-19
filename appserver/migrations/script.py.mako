"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from alembic import context
from alembic import op
from os import path
import sqlalchemy as sa
from sqlalchemy.orm import Session
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}
directory = path.realpath(path.dirname(__file__))

## Schema validation
# import fastjsonschema
# import json
# schema_file = path.join(directory, 'upgrade_data', <schema file>)
# with open(schema_file, 'rb') as f:
#    validate = fastjsonschema.compile(json.load(f))

## Declaring ORM models
# from sqlalchemy.ext.declarative import declarative_base
# Base = declarative_base()
#
# Example:
# class Files(Base):
#    __tablename__ = 'files'
#    id = Column(Integer, primary_key=True, autoincrement=True)
#    mime_type = Column(String(127), nullable=False)
#
## Ps be carefull when copying models from appserver as they might contain undesired lifecycle hooks

def upgrade():
    # session = Session(op.get_bind())
    ${upgrades if upgrades else "pass"}
    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    # session = Session(op.get_bind())
    ${downgrades if downgrades else "pass"}
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    # session = Session(op.get_bind())
    """Add optional data upgrade migrations here"""
    pass


def data_downgrades():
    # session = Session(op.get_bind())
    """Add optional data downgrade migrations here"""
    pass
