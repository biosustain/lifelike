from __future__ import with_statement

import logging
from functools import cached_property, cache
from io import BytesIO
from logging.config import fileConfig

from sqlalchemy import (
    Column,
    MetaData,
    Table,
    Integer,
    VARCHAR,
    and_,
    engine_from_config,
    event,
    select,
)
from sqlalchemy import pool
import sqlalchemy_utils

from alembic import context

from flask import current_app
from sqlalchemy.orm import Session, Query
from sqlalchemy.sql import Update, Insert

from migrations.utils import window_chunk

# flake8: noqa: OIG001 # This file does contain additional validation code
# it runs always against latest appserver therefore can be safly imported
from neo4japp.database import get_file_type_service
from neo4japp.models import FileContent, Files

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
config.set_main_option(
    'sqlalchemy.url',
    current_app.config.get('SQLALCHEMY_DATABASE_URI').replace('%', '%%'),
)
target_metadata = current_app.extensions['migrate'].db.metadata

BATCH_SIZE = 1

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


class MigrationValidator:
    logger = logging.getLogger('alembic.runtime.validation')

    class ValidationException(Exception):
        pass

    def __init__(self, conn):
        self.conn = conn
        self.updated_file_content_ids = set()
        self.unidentified_update_to_file_contents = False

    @cached_property
    def receive_before_execute_callback(self):
        def receive_before_execute(_, clauseelement, multiparams, params):
            updated_file_content_ids = set()
            unidentified_update_to_file_contents = False
            if (
                isinstance(clauseelement, (Update, Insert))
                and clauseelement.table.name == FileContent.__tablename__
            ):
                for params in multiparams:
                    if len(params) > 0:
                        for p in params:
                            content_id = p.get('id')
                            if content_id:
                                if p.get('raw_file'):
                                    updated_file_content_ids.add(content_id)
                            else:
                                unidentified_update_to_file_contents = True
                    else:
                        unidentified_update_to_file_contents = True
                self.update_change_list(
                    updated_file_content_ids, unidentified_update_to_file_contents
                )

        return receive_before_execute

    # Printing unique messages within revision
    @cache
    def _revision_notify(self, revision, *args, level=logging.INFO, **kwargs):
        self.logger.log(level, *args, **kwargs)

    # Wrap notification with revision id - log unique messages
    def _per_revision_notify(self, *args, **kwargs):
        self._revision_notify(
            context.get_context().get_current_revision(), *args, **kwargs
        )

    def __enter__(self):
        event.listen(self.conn, 'before_execute', self.receive_before_execute_callback)

    def __exit__(self, exc_type, exc_val, exc_tb):
        event.remove(self.conn, 'before_execute', self.receive_before_execute_callback)
        if exc_type is None:  # if no error has been thrown
            self.validate_file_contents()

    def update_change_list(
        self, updated_file_content_ids, unidentified_update_to_file_contents
    ):
        if unidentified_update_to_file_contents:
            self._per_revision_notify(
                'Unidentified file content update - '
                'all files will be validated as final step of migrating database'
            )
            self.unidentified_update_to_file_contents = (
                unidentified_update_to_file_contents
            )
        if len(updated_file_content_ids) > 0:
            self._per_revision_notify(
                'Identified file contents update for ids: '
                + ', '.join(str(content_id) for content_id in updated_file_content_ids)
            )
            self.updated_file_content_ids.update(updated_file_content_ids)

    def validate_file_contents(self):
        if (
            len(self.updated_file_content_ids) > 0
            or self.unidentified_update_to_file_contents
        ):
            t_files = Table(
                'files',
                MetaData(),
                Column('id', Integer(), primary_key=True),
                Column('mime_type'),
                Column('content_id', VARCHAR()),
            )

            t_files_content = Table(
                'files_content',
                MetaData(),
                Column('id', Integer(), primary_key=True),
                Column('raw_file', VARCHAR()),
            )

            query = select(
                [
                    t_files_content.c.id,
                    t_files_content.c.raw_file,
                    t_files.c.mime_type
                ]
            ).select_from(
                t_files_content.join(
                    t_files,
                    and_(
                        t_files.c.content_id == t_files_content.c.id,
                    ),
                )
            )

            if not self.unidentified_update_to_file_contents:
                query = query.where(t_files_content.c.id.in_(self.updated_file_content_ids))
                self._per_revision_notify(
                    'Validating file contents of: ', self.updated_file_content_ids
                )
            else:
                self._per_revision_notify('Validating all files contents')

            file_type_service = get_file_type_service()

            data = self.conn.execution_options(
                stream_results=True,
                max_row_buffer=BATCH_SIZE
            ).execute(query)

            for chunk in window_chunk(data, BATCH_SIZE):
                for content_id, raw_file, mime_type in chunk:
                    exceptions = []
                    try:
                        provider = file_type_service.get(mime_type)
                        provider.validate_content(
                            BytesIO(raw_file), log_status_messages=False
                        )
                    except Exception as validation_exception:
                        # TODO after migrating to python 3.11: use .add_note
                        try:
                            raise self.ValidationException(
                                f'FileContent(id={content_id}) {validation_exception}'
                            ) from validation_exception
                        except Exception as validation_exception:
                            self.logger.exception(validation_exception)
                            exceptions.append(validation_exception)
                    if len(exceptions) > 0:
                        raise self.ValidationException(
                            '\n'.join(
                                (
                                    f'{len(exceptions)} file content are not passing current validation rules:',
                                    *map(
                                        lambda exception: f'\t{exception}', exceptions
                                    ),
                                )
                            )
                        )


def run_migrations_offline():
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    def render_item(type_, obj, autogen_context):
        """Apply custom rendering for selected items"""
        if type_ == "type" and isinstance(obj, sqlalchemy_utils.types.TSVectorType):
            # Add import for this type
            autogen_context.imports.add("import sqlalchemy_utils")
            return "sqlalchemy_utils.types.TSVectorType"
        # Default rendering for other objects
        return False

    # this callback is used to prevent an auto-migration from being generated
    # when there are no changes to the schema
    # reference: http://alembic.zzzcomputing.com/en/latest/cookbook.html

    def process_revision_directives(context, revision, directives):
        if getattr(config.cmd_opts, 'autogenerate', False):
            script = directives[0]
            if script.upgrade_ops.is_empty():
                directives[:] = []
                logger.info('No changes in schema detected.')

    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
        # can also consider adding `executemany_values_page_size`
        # and `executemany_batch_page_size`
        # these determine how the query is broken up into batch
        # https://docs.sqlalchemy.org/en/13/dialects/postgresql.html#psycopg2-executemany-mode
        executemany_mode='values',
        executemany_values_page_size=10000,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            process_revision_directives=process_revision_directives,
            render_item=render_item,
            **current_app.extensions['migrate'].configure_args,
        )

        with context.begin_transaction():
            with MigrationValidator(context.get_bind()):
                context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
