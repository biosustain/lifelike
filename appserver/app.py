import importlib
import json
import logging
import os
import click
import sentry_sdk
from flask import g, request

from sqlalchemy import inspect, Table
from sqlalchemy.sql.expression import text

from neo4japp.constants import LogEventType
from neo4japp.database import db, get_account_service, get_elastic_service
from neo4japp.factory import create_app
from neo4japp.lmdb_manager import LMDBManager, AzureStorageProvider
from neo4japp.models import (
    AppUser,
    OrganismGeneMatch,
)
from neo4japp.models.files import FileAnnotationsVersion, AnnotationChangeCause
from neo4japp.utils.logger import EventLog

app_config = os.environ['FLASK_APP_CONFIG']
app = create_app(config=f'config.{app_config}')
logger = logging.getLogger(__name__)


@app.before_request
def request_navigator_log():
    with sentry_sdk.configure_scope() as scope:
        scope.set_tag(
            'transaction_id', request.headers.get('X-Transaction-Id'))
    app.logger.info(
        EventLog(event_type=LogEventType.SYSTEM.value).to_dict())


@app.cli.command("seed")
def seed():
    def find_existing_row(model, value):
        if isinstance(value, dict):
            f = value
        else:
            f = {
                model.primary_key[0].name: value,
            }
        return db.session.query(model).filter_by(**f).one()

    with open("fixtures/seed.json", "r") as f:
        fixtures = json.load(f)
        truncated_tables = []

        for fixture in fixtures:
            module_name, class_name = fixture['model'].rsplit('.', 1)
            module = importlib.import_module(module_name)
            model = getattr(module, class_name)

            if isinstance(model, Table):
                truncated_tables.append(model.name)
            else:
                model_meta = inspect(model)
                for table in model_meta.tables:
                    truncated_tables.append(table.name)

        logger.info("Clearing database of data...")
        conn = db.engine.connect()
        trans = conn.begin()
        for table in truncated_tables:
            logger.info(f"Truncating {table}...")
            conn.execute(f'ALTER TABLE "{table}" DISABLE TRIGGER ALL;')
            conn.execute(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE;')
            conn.execute(f'ALTER TABLE "{table}" ENABLE TRIGGER ALL;')
        trans.commit()

        logger.info("Inserting fixtures...")
        for fixture in fixtures:
            module_name, class_name = fixture['model'].rsplit('.', 1)
            module = importlib.import_module(module_name)
            model = getattr(module, class_name)

            if isinstance(model, Table):
                logger.info(f"Creating fixtures for {class_name}...")
                db.session.execute(model.insert(), fixture['records'])
                table = model
            else:
                model_meta = inspect(model)
                table = model.__table__
                relationships = model_meta.relationships
                logger.info(f"Creating fixtures for {class_name}...")

                for record in fixture['records']:
                    instance = model()
                    for key in record:
                        if key in relationships:
                            fk_model = relationships[key].mapper
                            if isinstance(record[key], list):
                                for value in record[key]:
                                    getattr(instance, key).append(
                                        find_existing_row(fk_model, value)
                                    )
                            else:
                                setattr(instance, key, find_existing_row(fk_model, record[key]))
                        else:
                            setattr(instance, key, record[key])
                    db.session.add(instance)

            db.session.flush()
            db.session.commit()

            if 'id' in table.columns:
                logger.info(f"Updating sequence for {table.name}...")
                conn.execute(f'SELECT pg_catalog.setval('
                             f'pg_get_serial_sequence(\'{table.name}\', \'id\'), '
                             f'MAX(id) + 1) FROM {table.name};')
            else:
                logger.info(f"No ID column for {class_name}")

            db.session.flush()
            db.session.commit()

        logger.info("Fixtures imported")


@app.cli.command("init-neo4j")
def init_neo4j():
    # Sets up the proper indexes for Neo4j
    from db import setup as neo4jsetup
    neo4jsetup()


@app.cli.command("drop_tables")
def drop_all_tables_and_enums():
    """
        Drop all tables and user enums from a postgres database
    """
    with app.app_context():

        # Get and drop all tables
        table_sql = (
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name NOT LIKE 'pg_%%'"
        )
        for table in [
            name for (name,) in db.engine.execute(text(table_sql))
        ]:
            db.engine.execute(text('DROP TABLE "%s" CASCADE' % table))

        # Get and drop all enums
        enum_sql = (
            "SELECT DISTINCT t.typname "
            "FROM pg_catalog.pg_type t "
            "JOIN pg_catalog.pg_enum e ON t.oid = e.enumtypid"
        )
        for enum in [
            name for (name,) in db.engine.execute(text(enum_sql))
        ]:
            db.engine.execute(text('DROP TYPE IF EXISTS "%s" CASCADE' % enum))


@app.cli.command("create-user")
@click.argument("name", nargs=1)
@click.argument("email", nargs=1)
def create_user(name, email):
    user = AppUser(
        username=name,
        first_name=name,
        last_name=name,
        email=email,
    )
    # set default role
    account_service = get_account_service()
    get_role = account_service.get_or_create_role('user')
    user.roles.extend([get_role])
    user.set_password('password')
    db.session.add(user)
    db.session.commit()


@app.cli.command("set-role")
@click.argument("email", nargs=1)
@click.argument("role", nargs=1)
def set_role(email, role):
    account_service = get_account_service()
    user = AppUser.query.filter_by(email=email).one()
    get_role = account_service.get_or_create_role(role)
    user.roles.extend([get_role])
    db.session.commit()


@app.cli.command('seed-organism-gene-match-table')
def seed_organism_gene_match_table():
    # reference to this directory
    directory = os.path.realpath(os.path.dirname(__file__))

    rows = []
    with open(os.path.join(directory, './migrations/upgrade_data/gene_names_for_4organisms.csv'), 'r') as f:  # noqa
        for i, line in enumerate(f.readlines()):
            if i == 0:
                continue

            # GeneID,GeneName,Synonym,Tax_ID, Organism
            data = line.split(',')

            row = OrganismGeneMatch(
                gene_id=data[0].strip(),
                gene_name=data[1].strip(),
                synonym=data[2].strip(),
                taxonomy_id=data[3].strip(),
                organism=data[4].strip(),
            )
            rows.append(row)

            if i % 1000 == 0:
                db.session.bulk_save_objects(rows)
                db.session.flush()
                rows = []
    db.session.commit()


@app.cli.command('reset-elastic')
def reset_elastic():
    """Seeds Elastic with all pipelines and indices. Typically should be used when a new Elastic DB
    is first created, but will also update/re-index the entire database if run later."""
    elastic_service = get_elastic_service()
    elastic_service.recreate_indices_and_pipelines()


@app.cli.command('recreate-elastic-index')
@click.argument('index_id', nargs=1)
@click.argument('index_mapping_file', nargs=1)
def update_or_create_index(index_id, index_mapping_file):
    """Given an index id and mapping file, creates a new elastic index. If the index already exists,
    we recreate it and re-index all documents."""
    elastic_service = get_elastic_service()
    elastic_service.update_or_create_index(index_id, index_mapping_file)


@app.cli.command('reindex-elastic')
def reindex_elastic():
    """Reindexes all files in the index given by the ELASTIC_FILE_INDEX_ID environment variable."""
    elastic_service = get_elastic_service()
    elastic_service.index_files()


@app.cli.command('reannotate')
def reannotate_all():
    """ CAUTION: Master command to reannotate all files
    in the database. """
    from neo4japp.blueprints.annotations import annotate
    from neo4japp.models import Files, FileContent
    from neo4japp.exceptions import AnnotationError
    files = db.session.query(
        Files.id,
        Files.annotations,
        Files.custom_annotations,
        Files.excluded_annotations,
        Files.file_id,
        Files.filename,
        FileContent.raw_file,
    ).join(
        FileContent,
        FileContent.id == Files.content_id,
    ).all()
    updated_files = []
    versions = []
    for fi in files:
        try:
            update, version = annotate(fi, AnnotationChangeCause.SYSTEM_REANNOTATION)
        except AnnotationError:
            logger.info('Failed to annotate: <id:{fi.id}>')
        else:
            updated_files.append(update)
            versions.append(version)
    db.session.bulk_insert_mappings(FileAnnotationsVersion, versions)
    db.session.bulk_update_mappings(Files, updated_files)
    db.session.commit()


@app.cli.command('load-lmdb')
def load_lmdb():
    """ Downloads LMDB files from Cloud to Local for application """
    manager = LMDBManager(AzureStorageProvider(), 'lmdb')
    lmdb_dir_path = os.path.join(app.root_path, 'services/annotations/lmdb')
    manager.download_all(lmdb_dir_path)
    manager.update_all_dates()


@app.cli.command('upload-lmdb')
def upload_lmdb():
    """ Uploads LMDB files from local to Azure cloud storage.
    To upload LMDB files,
    1. Load the files into the proper directories under
    ../services/annotations/lmdb/<categories>/<data.mdb|lock.mdb>
    2. Update the 'lmdb_config.json' under the lmdb_manager directory
    to the correct versions
    """
    manager = LMDBManager(AzureStorageProvider(), 'lmdb')
    lmdb_dir_path = os.path.join(app.root_path, 'services/annotations/lmdb')
    manager.upload_all(lmdb_dir_path)
