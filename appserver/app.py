import importlib
import json
import logging
import os
import click
import sentry_sdk
from datetime import datetime
from flask import request

from sqlalchemy import func, MetaData, inspect, Table
from sqlalchemy.sql.expression import text

from neo4japp.constants import TIMEZONE
from neo4japp.database import db, get_account_service, get_elastic_service
from neo4japp.factory import create_app
from neo4japp.models import (
    AppUser,
    OrganismGeneMatch,
)
from neo4japp.utils.logger import EventLog

app_config = os.environ['FLASK_APP_CONFIG']
app = create_app(config=f'config.{app_config}')
logger = logging.getLogger(__name__)


@app.route('/')
def home():
    return 'Ouch! You hit me.'


@app.before_request
def request_navigator_log():
    with sentry_sdk.configure_scope() as scope:
        scope.set_tag(
            'transaction_id', request.headers.get('X-Transaction-Id'))
    app.logger.info(
        EventLog(event_type='user navigate').to_dict())


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


@app.cli.command('seed-elastic')
def seed_elasticsearch():
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
        Files.file_id,
        Files.filename,
        FileContent.raw_file,
    ).join(
        FileContent,
        FileContent.id == Files.content_id,
    ).all()
    updated_files = []
    for fi in files:
        try:
            annotations = annotate(doc=fi)
        except AnnotationError:
            logger.info('Failed to annotate: <id:{fi.id}>')
        else:
            updated_files.append(annotations)
    db.session.bulk_update_mappings(Files, updated_files)
    db.session.commit()


@app.cli.command('global-annotation')
@click.argument('filename', nargs=1)
def seed_global_annotation_list(filename):
    """
    TODO: Make generic
    * This is used as a temporary stop gap
    to seed some existing data.
    Seeds the 'global_list' table with
    a given exclusion/inclusion list """
    from neo4japp.models import FileContent, GlobalList
    FIXTURE_PATH = './fixtures'
    # Randomly choose a file to associate with.
    # Make the file_id column nullable if we
    # don't use it, or refactor this function
    # to use a "meaningful" file_id
    random_file = FileContent.query.first()
    with open(os.path.join(FIXTURE_PATH, filename)) as fi:
        fix = json.load(fi)
        inclusions = fix['inclusions']
        exclusions = fix['exclusions']
        current_time = datetime.now(TIMEZONE)
        for new_incl in inclusions:
            gl = GlobalList(
                annotation=new_incl,
                type='inclusion',
                file_id=random_file.id,
                reviewed=False,
                approved=False,
                creation_date=new_incl.get('inclusion_date', current_time),
                modified_date=new_incl.get('inclusion_date', current_time),
            )
            db.session.add(gl)
        for new_excl in exclusions:
            gl = GlobalList(
                annotation=new_excl,
                type='exclusion',
                file_id=random_file.id,
                reviewed=False,
                approved=False,
                creation_date=new_incl.get('exclusion_date', current_time),
                modified_date=new_incl.get('exclusion_date', current_time),
            )
            db.session.add(gl)
        db.session.commit()
    print('Completed seeding global inclusion/exclusion list')


@app.cli.command('fix-projects')
def fix_project_acl():
    # TODO: Deprecate me after production release
    # Used for a staging fix
    from neo4japp.models import (
        AppRole,
        AccessControlPolicy,
        AccessActionType,
        AccessRuleType,
        Projects,
    )

    # Each project should have 6 ACP
    # 2 ACP (READ + WRITE) x 3 Roles (read, write, admin) = 6 combinations
    q = db.session.query(
        AccessControlPolicy.asset_id,
        func.count(AccessControlPolicy.action),
    ).filter(
        AccessControlPolicy.asset_type == Projects.__tablename__
    ).group_by(
        AccessControlPolicy.asset_id,
    ).having(
        func.count(AccessControlPolicy.asset_id) == 6
    )

    project_ids = db.session.query(Projects).all()
    project_ids = [p.id for p in project_ids]

    # Projects with correct ACP settings
    acp_projects = [i for i, _ in q.all()]

    # Projects that do not have the correct ACP settings
    projs_to_fix = set(project_ids) - set(acp_projects)

    project_admin = db.session.query(AppRole).filter_by(name='project-admin').one()
    project_read = db.session.query(AppRole).filter_by(name='project-read').one()
    project_write = db.session.query(AppRole).filter_by(name='project-write').one()

    acp_rules = [
        (project_admin.id, AccessActionType.READ, AccessRuleType.ALLOW),
        (project_admin.id, AccessActionType.WRITE, AccessRuleType.ALLOW),
        (project_read.id, AccessActionType.READ, AccessRuleType.ALLOW),
        (project_read.id, AccessActionType.WRITE, AccessRuleType.DENY),
        (project_write.id, AccessActionType.READ, AccessRuleType.ALLOW),
        (project_write.id, AccessActionType.WRITE, AccessRuleType.ALLOW),
    ]

    try:
        for pid in projs_to_fix:
            for principal_id, action, rule in acp_rules:
                db.session.execute(AccessControlPolicy.__table__.insert().values(
                    action=action,
                    asset_type=Projects.__tablename__,
                    asset_id=pid,
                    principal_type=AppRole.__tablename__,
                    principal_id=principal_id,
                    rule_type=rule,
                ))
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        db.session.close()
        print('error: ', ex)
    print('Completed ACP fix.')
