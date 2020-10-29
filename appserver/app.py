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


@app.cli.command('bulk-upload')
@click.argument('gcp_source', nargs=1)
@click.argument('project_name', nargs=1)
@click.argument('username', nargs=1)
def bulk_upload_files(gcp_source, project_name, username):
    """ Performs a bulk upload of files and annotation from
    a given Google Storage Bucket.

    Example usage:

    > flask bulk-upload cag-data test admin

    This will create a project called 'cag-data'
    and load PDF files from a Google Cloud storage.

    NOTE: This is meant for an emergency backup. A more
    robust system should be designed for this or this
    should be refactored once we have a user facing
    bulk interface.
    """
    import hashlib
    import uuid
    import re
    import io
    from google.cloud import storage
    from sqlalchemy.orm.exc import NoResultFound
    from neo4japp.services import ProjectsService
    from neo4japp.models import Files, FileContent, Projects
    import neo4japp.models.files_queries as files_queries
    from neo4japp.exceptions import DuplicateRecord
    from neo4japp.blueprints.files import extract_doi
    from neo4japp.blueprints.annotations import annotate
    from pdfminer import high_level
    from flask import g

    with app.app_context():
        user = db.session.query(AppUser).filter_by(username=username).one()
        g.current_user = user

        projects_service = ProjectsService(session=db.session)

        storage_client = storage.Client()
        bucket = storage_client.get_bucket(gcp_source)

        project = db.session.query(Projects.id).filter_by(project_name=project_name).one_or_none()
        if project is None:
            new_project = Projects(project_name=project_name, description='', users=[user.id])
            project = projects_service.create_projects(user, new_project)

        root_dir = projects_service.get_root_dir(project)

        def load_file(raw_content, filename):
            max_fname_length = Files.filename.property.columns[0].type.length
            if len(filename) > max_fname_length:
                name, extension = os.path.splitext(filename)
                if len(extension) > max_fname_length:
                    extension = '.dat'
                filename = name[:max(0, max_fname_length - len(extension))] + extension
            checksum_sha256 = hashlib.sha256(raw_content).digest()
            try:
                file_content = db.session.query(
                    FileContent.id
                ).filter(
                    FileContent.checksum_sha256 == checksum_sha256
                ).one()
            except NoResultFound:
                file_content = FileContent(
                    raw_file=raw_content,
                    checksum_sha256=checksum_sha256,
                )
                db.session.add(file_content)
                db.session.flush()

            file_id = str(uuid.uuid4())
            doi = extract_doi(raw_content, file_id, filename)
            exists = files_queries.filename_exist(
                filename=filename,
                directory_id=root_dir.id,
                project_id=project.id,
            )
            if exists:
                raise DuplicateRecord('Filename already exists, please choose a different one.')

            new_file = Files(
                file_id=file_id,
                filename=filename,
                description='',
                content_id=file_content.id,
                user_id=user.id,
                project=project.id,
                dir_id=root_dir.id,
                upload_url='',
            )
            db.session.add(new_file)
            db.session.commit()
            return new_file

        new_file_ids = []
        for fi in bucket.list_blobs():
            print(f'Loading file [{fi.name}]...')
            raw_content = fi.download_as_bytes()
            new_file = load_file(raw_content, fi.name)
            new_file_ids.append(new_file.file_id)

        docs = files_queries.get_all_files_and_content_by_id(
            file_ids=new_file_ids,
            project_id=project.id,
        ).all()

        annotated_files = [annotate(doc) for doc in docs]

        db.session.bulk_update_mappings(Files, annotated_files)
        db.session.commit()
        print('Done')


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
