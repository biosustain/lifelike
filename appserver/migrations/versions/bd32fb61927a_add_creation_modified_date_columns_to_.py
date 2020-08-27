"""Add creation/modified date columns to tables

Revision ID: bd32fb61927a
Revises: a6f4dec3a2d6
Create Date: 2020-08-26 22:42:37.828585

"""
from alembic import context
from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import table, column

from neo4japp.database import db


# revision identifiers, used by Alembic.
revision = 'bd32fb61927a'
down_revision = 'a6f4dec3a2d6'
branch_labels = None
depends_on = None


t_appuser = table(
    'appuser',
    column('creation_date', sa.DateTime),
    column('modified_date', sa.DateTime),
)

t_directory = table(
    'directory',
    column('creation_date', sa.DateTime),
    column('modified_date', sa.DateTime),
)

t_files = table(
    'files',
    column('modified_date', sa.DateTime),
)

t_global_list = table(
    'global_list',
    column('creation_date', sa.DateTime),
    column('modified_date', sa.DateTime),
)

t_project = table(
    'project',
    column('creation_date', sa.DateTime),
    column('date_modified', sa.DateTime),
)

t_project_backup = table(
    'project_backup',
    column('creation_date', sa.DateTime),
    column('date_modified', sa.DateTime),
)

t_projects = table(
    'projects',
    column('modified_date', sa.DateTime),
)

t_worksheets = table(
    'worksheets',
    column('modified_date', sa.DateTime),
)


def upgrade():
    op.add_column('appuser', sa.Column('creation_date', sa.DateTime(), nullable=True))
    op.add_column('appuser', sa.Column('modified_date', sa.DateTime(), nullable=True))
    op.add_column('directory', sa.Column('creation_date', sa.DateTime(), nullable=True))
    op.add_column('directory', sa.Column('modified_date', sa.DateTime(), nullable=True))
    op.add_column('files', sa.Column('modified_date', sa.DateTime(), nullable=True))
    op.add_column('global_list', sa.Column('creation_date', sa.DateTime(), nullable=True))
    op.add_column('global_list', sa.Column('modified_date', sa.DateTime(), nullable=True))
    op.add_column('project', sa.Column('creation_date', sa.DateTime(), nullable=True))
    op.add_column('project_backup', sa.Column('creation_date', sa.DateTime(), nullable=True))
    op.add_column('projects', sa.Column('modified_date', sa.DateTime(), nullable=True))
    op.add_column('worksheets', sa.Column('modified_date', sa.DateTime(), nullable=True))

    if context.get_x_argument(as_dictionary=True).get('data_migrate', None):
        data_upgrades()


def downgrade():
    op.drop_column('worksheets', 'modified_date')
    op.drop_column('projects', 'modified_date')
    op.drop_column('project_backup', 'creation_date')
    op.drop_column('project', 'creation_date')
    op.drop_column('global_list', 'modified_date')
    op.drop_column('global_list', 'creation_date')
    op.drop_column('files', 'modified_date')
    op.drop_column('directory', 'modified_date')
    op.drop_column('directory', 'creation_date')
    op.drop_column('appuser', 'modified_date')
    op.drop_column('appuser', 'creation_date')


def data_upgrades():
    """Add optional data upgrade migrations here"""
    session = Session(op.get_bind())

    # appuser -> creation/modified
    appuser_update_modified_date_proc_query = """
        CREATE OR REPLACE FUNCTION appuser_update_modified_date() RETURNS trigger AS $appuser_update_modified_date$
        BEGIN
            NEW.modified_date := current_timestamp;
            RETURN NEW;
        END;
        $appuser_update_modified_date$ LANGUAGE plpgsql;
    """
    session.execute(appuser_update_modified_date_proc_query)

    appuser_update_modified_date_trigger_query = """
        CREATE TRIGGER appuser_modified_date_stamp BEFORE INSERT OR UPDATE ON appuser
            FOR EACH ROW EXECUTE PROCEDURE appuser_update_modified_date();
    """
    session.execute(appuser_update_modified_date_trigger_query)

    session.execute(
        t_appuser.update().values(
            creation_date=db.func.now(),
        )
    )

    # directory -> creation/modified
    directory_update_modified_date_proc_query = """
        CREATE OR REPLACE FUNCTION directory_update_modified_date() RETURNS trigger AS $directory_update_modified_date$
        BEGIN
            NEW.modified_date := current_timestamp;
            RETURN NEW;
        END;
        $directory_update_modified_date$ LANGUAGE plpgsql;
    """
    session.execute(directory_update_modified_date_proc_query)

    directory_update_modified_date_trigger_query = """
        CREATE TRIGGER directory_modified_date_stamp BEFORE INSERT OR UPDATE ON directory
            FOR EACH ROW EXECUTE PROCEDURE directory_update_modified_date();
    """
    session.execute(directory_update_modified_date_trigger_query)

    session.execute(
        t_directory.update().values(
            creation_date=db.func.now(),
        )
    )

    # files -> modified
    files_update_modified_date_proc_query = """
        CREATE OR REPLACE FUNCTION files_update_modified_date() RETURNS trigger AS $files_update_modified_date$
        BEGIN
            NEW.modified_date := current_timestamp;
            RETURN NEW;
        END;
        $files_update_modified_date$ LANGUAGE plpgsql;
    """
    session.execute(files_update_modified_date_proc_query)

    files_update_modified_date_trigger_query = """
        CREATE TRIGGER files_modified_date_stamp BEFORE INSERT OR UPDATE ON files
            FOR EACH ROW EXECUTE PROCEDURE files_update_modified_date();
    """
    session.execute(files_update_modified_date_trigger_query)

    session.execute(
        t_files.update().values(
            modified_date=db.func.now()
        )
    )

    # global_list -> creation/modified
    global_list_update_modified_date_proc_query = """
        CREATE OR REPLACE FUNCTION global_list_update_modified_date() RETURNS trigger AS $global_list_update_modified_date$
        BEGIN
            NEW.modified_date := current_timestamp;
            RETURN NEW;
        END;
        $global_list_update_modified_date$ LANGUAGE plpgsql;
    """
    session.execute(global_list_update_modified_date_proc_query)

    global_list_update_modified_date_trigger_query = """
        CREATE TRIGGER global_list_modified_date_stamp BEFORE INSERT OR UPDATE ON global_list
            FOR EACH ROW EXECUTE PROCEDURE global_list_update_modified_date();
    """
    session.execute(global_list_update_modified_date_trigger_query)

    session.execute(
        t_global_list.update().values(
            creation_date=db.func.now(),
        )
    )

    # project -> creation
    project_update_date_modified_proc_query = """
        CREATE OR REPLACE FUNCTION project_update_date_modified() RETURNS trigger AS $project_update_date_modified$
        BEGIN
            NEW.date_modified := current_timestamp;
            RETURN NEW;
        END;
        $project_update_date_modified$ LANGUAGE plpgsql;
    """
    session.execute(project_update_date_modified_proc_query)

    project_update_date_modified_trigger_query = """
        CREATE TRIGGER project_date_modified_stamp BEFORE INSERT OR UPDATE ON project
            FOR EACH ROW EXECUTE PROCEDURE project_update_date_modified();
    """
    session.execute(project_update_date_modified_trigger_query)

    session.execute(
        t_project.update().values(
            creation_date=db.func.now(),
        )
    )

    # project_backup -> creation
    project_backup_update_date_modified_proc_query = """
        CREATE OR REPLACE FUNCTION project_backup_update_date_modified() RETURNS trigger AS $project_backup_update_date_modified$
        BEGIN
            NEW.date_modified := current_timestamp;
            RETURN NEW;
        END;
        $project_backup_update_date_modified$ LANGUAGE plpgsql;
    """
    session.execute(project_backup_update_date_modified_proc_query)

    project_backup_update_date_modified_trigger_query = """
        CREATE TRIGGER project_backup_date_modified_stamp BEFORE INSERT OR UPDATE ON project_backup
            FOR EACH ROW EXECUTE PROCEDURE project_backup_update_date_modified();
    """
    session.execute(project_backup_update_date_modified_trigger_query)

    session.execute(
        t_project_backup.update().values(
            creation_date=db.func.now(),
        )
    )

    # projects -> modified
    projects_update_modified_date_proc_query = """
        CREATE OR REPLACE FUNCTION projects_update_modified_date() RETURNS trigger AS $projects_update_modified_date$
        BEGIN
            NEW.modified_date := current_timestamp;
            RETURN NEW;
        END;
        $projects_update_modified_date$ LANGUAGE plpgsql;
    """
    session.execute(projects_update_modified_date_proc_query)

    projects_update_modified_date_trigger_query = """
        CREATE TRIGGER projects_modified_date_stamp BEFORE INSERT OR UPDATE ON projects
            FOR EACH ROW EXECUTE PROCEDURE projects_update_modified_date();
    """
    session.execute(projects_update_modified_date_trigger_query)

    session.execute(
        t_projects.update().values(
            modified_date=db.func.now()
        )
    )

    # worksheets -> modified
    worksheets_update_modified_date_proc_query = """
        CREATE OR REPLACE FUNCTION worksheets_update_modified_date() RETURNS trigger AS $worksheets_update_modified_date$
        BEGIN
            NEW.modified_date := current_timestamp;
            RETURN NEW;
        END;
        $worksheets_update_modified_date$ LANGUAGE plpgsql;
    """
    session.execute(worksheets_update_modified_date_proc_query)

    worksheets_update_modified_date_trigger_query = """
        CREATE TRIGGER worksheets_modified_date_stamp BEFORE INSERT OR UPDATE ON worksheets
            FOR EACH ROW EXECUTE PROCEDURE worksheets_update_modified_date();
    """
    session.execute(worksheets_update_modified_date_trigger_query)

    session.execute(
        t_worksheets.update().values(
            modified_date=db.func.now()
        )
    )


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
