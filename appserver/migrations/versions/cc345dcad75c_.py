"""
    Data migration from one column to another.
    Single hyperlink into multiple hyperlinks

    Revision ID: cc345dcad75c
    Revises: b6b9fb435404
    Create Date: 2020-07-07 15:13:38.895016
"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm.session import Session

from neo4japp.database import db
from app import app

from neo4japp.models import (
  Project
)


# revision identifiers, used by Alembic.
revision = 'cc345dcad75c'
down_revision = 'b6b9fb435404'
branch_labels = None
depends_on = None


def upgrade():
    pass
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

    # Pull in the entire collection of maps
    projects = session.query(Project).all()

    # Iterate through each project
    for project in projects:

        graph = project.graph

        # Iterate through each node
        def process_node(node):
            node_data = node.get("data", {})

            single_hyperlink = node_data.get("hyperlink", "")
        
            # Check if it has hyperlinks & and if not instantiate it
            if "hyperlinks" not in node_data:
                node_data["hyperlinks"] = []

            if len(single_hyperlink):
                node_data["hyperlinks"].append({
                    "url": single_hyperlink,
                    "domain": ""
                })

            node["data"] = node_data
            return node
        
        graph["nodes"] = list(
            map(
                process_node,
                graph.get("nodes", [])
            )
        )

        session.query(Project).filter(Project.id == project.id).update({Project.graph: graph})
 
    session.commit()


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
