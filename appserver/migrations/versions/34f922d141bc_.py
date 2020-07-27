""" Move all of the users maps & files from beta-project
    to their own personal project

Revision ID: 34f922d141bc
Revises: 36d25e171658
Create Date: 2020-07-24 21:19:46.808252

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm.session import Session

from neo4japp.models import (
    AppUser, Project as Map, Files,
    Directory, Projects, projects_collaborator_role,
    AppRole
)

# revision identifiers, used by Alembic.
revision = '34f922d141bc'
down_revision = '36d25e171658'
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

    users = session.query(AppUser).all()

    for user in users:
        # Create personal project for that user
        projects = Projects(
            project_name="{}'s Personal Project".format(user.username),
            description='Personal Project folder',
            users=[user.id]
        )
        session.add(projects)
        session.flush()

        default_dir = Directory(
            name='/', directory_parent_id=None,
            projects_id=projects.id, user_id=user.id
        )
        session.add(default_dir)
        session.flush()

        # Get admin role
        write_role = session.query(AppRole).filter(
            AppRole.name == 'project-admin'
        ).one()

        session.execute(
            projects_collaborator_role.insert(),
            [dict(
                appuser_id=user.id,
                projects_id=projects.id,
                app_role_id=write_role.id,
            )]
        )
        session.flush()


        # Go through every map and assign directory id to map
        for m in session.query(Map).filter(Map.user_id == user.id).all():
            setattr(m, 'dir_id', default_dir.id)
            session.add(m)

        # Go through every file and assign directory id to file
        for fi in session.query(Files).filter(Files.user_id == user.id).all():
            setattr(fi, 'dir_id', default_dir.id)
            session.add(fi)

        session.commit()


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
