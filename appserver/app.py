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
from neo4japp.models.files import FileAnnotationsVersion, AnnotationChangeCause
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


@app.cli.command('files2gcp')
@click.argument('bucket_name', nargs=1)
@click.argument('project_name', nargs=1)
@click.argument('username', nargs=1)
def files2gcp(bucket_name, project_name, username):
    """ Fetches all the raw PDF files along
    with some meta data information on the
    Files and uploads them into Google Cloud
    Storage. This data can then be used to
    seed a different database environment.

    Example usage:
    > flask files2gcp cag-data cag-data testuser

    NOTE: This is meant for an emergency transfer
    of files to different envrionments.

    NOTE: This may pick up non-pdf files
    """
    import json
    from google.cloud import storage
    from google.cloud.exceptions import BadRequest, NotFound
    from sqlalchemy import and_
    from neo4japp.encoders import CustomJSONEncoder
    from neo4japp.models import (
        AppUser,
        Files,
        FileContent,
        Projects,
    )

    storage_client = storage.Client()

    try:
        bucket = storage_client.get_bucket(bucket_name)
    except (NotFound, BadRequest):
        bucket = storage_client.bucket(bucket_name)
        bucket = storage_client.create_bucket(bucket, location='us')
        app.logger.info(f'Created Google Cloud Bucket : {bucket_name}')

    with app.app_context():
        query = db.session.query(
            Files,
            FileContent,
        ).join(
            Files,
            Files.content_id == FileContent.id
        ).join(
            Projects,
            Files.project == Projects.id,
        ).join(
            AppUser,
            Files.user_id == AppUser.id,
        ).filter(
            and_(
                Projects.project_name == project_name,
                AppUser.username == username,
            )
        )
        for fi, fi_content in query.all():
            if fi.filename.find('.enrichment') > -1:
                app.logger.info(f'File "{fi.filename}" looks like an enrichment file. Skipping')
            else:
                app.logger.info(f'Processing file {fi.filename}...')
                filename = f"{fi.filename.replace('.pdf', '')}.pdf"
                blob = bucket.blob(f'raw_file/{filename}')
                blob.upload_from_string(fi_content.raw_file, 'application/pdf')
                meta_filename = f"{fi.filename.replace('.pdf', '')}.json"
                meta_blob = bucket.blob(f'meta_data/{meta_filename}')
                fi_json = json.dumps(fi.to_dict(), cls=CustomJSONEncoder)
                meta_blob.upload_from_string(fi_json, 'application/json')
        app.logger.info(f'Finished loading all files')


@app.cli.command('bulk-upload')
@click.argument('gcp_source', nargs=1)
@click.argument('project_name', nargs=1)
@click.argument('username', nargs=1)
@click.option('--reannotate', default=False, help='if false, does not reannotate PDF files')
def bulk_upload_files(gcp_source, project_name, username, reannotate):
    """ Performs a bulk upload of files and annotation from
    a given Google Storage Bucket.

    Example usage:

    > flask bulk-upload cag-data test admin

    Example usage 2:
    This will add the files into the annotation pipeline

    > flask bulk-upload cag-data test admin --reannotate=True

    This will:
        1. create a project called 'cag-data'
        2. load PDF files from a Google Cloud Storage
        3. load the corresponding file's 'metadata' such as
        custom annotations
        4. modify all references of 'user_id' in the
        any annotations to the user specified in the CLI

    NOTE: This is meant for an emergency backup. A more
    robust system should be designed for this or this
    should be refactored once we have a user facing
    bulk interface.
    """
    import copy
    import hashlib
    import uuid
    import re
    import io
    import json
    from google.cloud import storage
    from sqlalchemy import and_
    from sqlalchemy.orm.exc import NoResultFound
    from neo4japp.services import ProjectsService
    from neo4japp.models import (
        AppRole,
        AppUser,
        Files,
        FileContent,
        Projects,
        projects_collaborator_role,
    )
    import neo4japp.models.files_queries as files_queries
    from neo4japp.exceptions import AnnotationError
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

        project = db.session.query(
            Projects.id
        ).filter(
            Projects.project_name == project_name
        ).join(
            projects_collaborator_role,
            Projects.id == projects_collaborator_role.c.projects_id,
        ).join(
            AppUser,
            AppUser.id == projects_collaborator_role.c.appuser_id,
        ).join(
            AppRole,
            AppRole.id == projects_collaborator_role.c.app_role_id
        ).filter(
            and_(
                AppUser.id == user.id,
                AppRole.name == 'project-admin',
            )
        ).one_or_none()

        if project is None:
            new_project = Projects(project_name=project_name, description='', users=[user.id])
            project = projects_service.create_projects(user, new_project)

        root_dir = projects_service.get_root_dir(project)

        def format_annotations(metadata):
            """ Swaps the user_ids in the annotations """
            exclusions = metadata['excludedAnnotations']
            custom_annotations = metadata['customAnnotations']
            for excl in exclusions:
                excl.update({'user_id': user.id})
            for c in custom_annotations:
                c.update({'user_id': user.id})
            return metadata

        def load_file(raw_content, filename, metadata):
            meta_json = json.loads(metadata)
            meta_json = format_annotations(meta_json)

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
                app.logger.info(f'Filename {filename} already exists. Failed to load.')
                return None

            new_file = Files(
                file_id=file_id,
                filename=meta_json['filename'],
                description=meta_json['description'],
                content_id=file_content.id,
                user_id=user.id,
                project=project.id,
                dir_id=root_dir.id,
                upload_url=meta_json['uploadUrl'],
                excluded_annotations=meta_json['excludedAnnotations'],
                custom_annotations=meta_json['customAnnotations'],
                creation_date=meta_json['creationDate'],
                modified_date=meta_json['modifiedDate'],
                annotations=meta_json['annotations'],
                annotations_date=meta_json['annotationsDate'],
            )
            db.session.add(new_file)
            db.session.commit()
            return new_file

        new_file_ids = []

        for fi in bucket.list_blobs(prefix='raw_file'):
            _, filename = fi.name.split('/')
            metadata = bucket.get_blob(f"meta_data/{filename.replace('.pdf', '.json')}")
            print(f'Loading file [{filename}]...')
            raw_content = fi.download_as_bytes()
            try:
                new_file = load_file(raw_content, filename, metadata.download_as_bytes())
                if new_file is not None:
                    new_file_ids.append(new_file.file_id)
            except Exception as e:
                print('Failed to load file: {filename}', str(e))
                db.session.rollback()
                pass

        docs = files_queries.get_all_files_and_content_by_id(
            file_ids=new_file_ids,
            project_id=project.id,
        ).all()

        if reannotate:
            annotated_files = []
            versions = []
            for doc in docs:
                try:
                    update, version = annotate(doc, AnnotationChangeCause.SYSTEM_REANNOTATION)
                    annotated_files.append(update)
                    versions.append(version)
                except (AnnotationError, Exception):
                    app.logger.info(f'Filename {filename} failed to annotate.')

            db.session.bulk_insert_mappings(FileAnnotationsVersion, versions)
            db.session.bulk_update_mappings(Files, annotated_files)
        db.session.commit()
        print('Done')


@app.cli.command('gcp2global')
@click.argument('bucket_name', nargs=1)
@click.argument('mapping_file', nargs=1)
@click.argument('username', nargs=1)
def seed_global_annotation_from_gcp(bucket_name, mapping_file, username):
    """ Used with global2gcp to seed the data from the output
    into the current database environment.
    Example usage:

    > flask gcp2global staging-annotations global-annotations.json test
    """
    import copy
    import hashlib
    from google.cloud import storage
    from neo4japp.models import (
        AppUser,
        GlobalList,
        FileContent,
    )

    FILE_PREFIX = 'global-file_'

    user = db.session.query(AppUser).filter(
        AppUser.username == username).one()
    storage_client = storage.Client()
    bucket = storage_client.get_bucket(bucket_name)

    global_blob = bucket.get_blob(mapping_file)
    global_json = json.loads(global_blob.download_as_string())

    for annotation in global_json['annotations']:
        file_id = annotation['fileId']
        filename = f'{FILE_PREFIX}{file_id}.pdf'
        file_blob = bucket.get_blob(f'raw_file/{filename}').download_as_bytes()
        checksum_sha256 = hashlib.sha256(file_blob).digest()
        file_content = db.session.query(
            FileContent.id
        ).filter(
            FileContent.checksum_sha256 == checksum_sha256
        ).one_or_none()
        # Previous file found, use that file id
        if file_content:
            file_id = file_content[0]
            app.logger.info(f'Previous file found: id ({file_id})')
        # No previous file, upload it and use that id
        else:
            new_fc = FileContent(
                raw_file=file_blob,
                checksum_sha256=checksum_sha256,
            )
            db.session.add(new_fc)
            db.session.flush()
            file_id = new_fc.id

        app.logger.info(f'Adding new file: id ({file_id})')
        annotation_json = copy.deepcopy(annotation['annotation'])
        # Not possible to transfer users across different
        # environments unless they had the same login, so
        # we chose an arbitrary user to assign the annotations to
        annotation_json['user_id'] = user.id
        global_list = GlobalList(
            annotation=annotation_json,
            type=annotation['type'],
            file_id=file_id,
            reviewed=annotation['reviewed'],
            approved=annotation['approved'],
            creation_date=annotation['creationDate'],
            modified_date=annotation['modifiedDate'],
        )
        try:
            db.session.add(global_list)
            db.session.commit()
        except Exception as ex:
            app.logger.info(f'Failed to load annotation id: {annotation.id}')
            db.session.rollback()
        app.logger.info(f'Done loading global annotation list...')


@app.cli.command('global2gcp')
@click.argument('bucket_name', nargs=1)
@click.argument('users_filter', nargs=-1)
def global2gcp(bucket_name, users_filter):
    """ Fetches all of the raw PDF files along
    with its associated global annotations.
    This data is stored on Google Cloud Storage.
    The functionality is used to enable transferring
    global annotations to different database environments.

    Example usage:
    > flask global2gcp staging-annotations

    Example usage 2:
    This will filter only for global annotations by
    the listed usernames
    > flask global2gcp staging-annotations evetra shawib

    NOTE: This is meant for an emergency transfer of
    global annotations to different environments.

    NOTE: The annotations will lose its original user
    reference as user ids are different across different
    databases.
    """
    import json
    import copy
    from sqlalchemy import or_
    from google.cloud import storage
    from google.cloud.exceptions import NotFound
    from neo4japp.models import AppUser, FileContent, GlobalList

    storage_client = storage.Client()

    try:
        bucket = storage_client.get_bucket(bucket_name)
    except NotFound:
        bucket = storage_client.bucket(bucket_name)
        bucket = storage_client.create_bucket(bucket, location='us')
        app.logger.info(f'Created Google Cloud Bucket : {bucket_name}')
    with app.app_context():
        if users_filter:
            filters = [AppUser.username == u for u in users_filter]
            query = db.session.query(
                GlobalList,
                FileContent
            ).join(
                FileContent
            ).join(
                AppUser,
                AppUser.id == GlobalList.annotation['user_id'].as_integer()
            ).filter(or_(*filters))
        else:
            query = db.session.query(
                GlobalList,
                FileContent,
            ).join(
                FileContent
            )
        data = []
        app.logger.info('Processing files...')
        # Multiple annotations can refer to a single file; only want one copy
        # of the raw file
        duplicate_files = set()
        for gl, fc in query.all():
            # exclude annotations so there's no snake to camel conversion
            gl_dict = gl.to_dict()
            # TODO: Need to refactor RDBMS to_dict() to serialize dates correctly
            gl_dict['creationDate'] = str(gl_dict['creationDate'])
            gl_dict['modifiedDate'] = str(gl_dict['modifiedDate'])
            data.append(gl_dict)
            if gl.file_id not in duplicate_files:
                duplicate_files.add(gl.file_id)
                gcp_filename = f'global-file_{gl.file_id}.pdf'
                # Create a unique identifier to trace back the
                # global annotation to the raw file
                blob = bucket.blob(f'raw_file/{gcp_filename}')
                blob.upload_from_string(fc.raw_file, 'application/pdf')
        annotation_blob = bucket.blob('global-annotations.json')
        annotation_blob.upload_from_string(json.dumps(
            dict(annotations=data)
        ), 'application/json')
    app.logger.info(f'Finish loading files to bucket: {bucket_name}')


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


@app.cli.command('kg-stats')
def refresh_kg_statistics():
    """
    Used for pulling in data about our neo4j database
    and adding it to a redis cache. This cache is viewable
    via the kg-statistics visualizer.

    NOTE: This command bogs down neo4j pretty heavily,
    so we only want to run this sparingly. """
    from neo4japp.database import get_kg_statistics_service
    stat_service = get_kg_statistics_service()
    statistics = stat_service.get_kg_statistics()
    stat_service.set_cache_data('kg_statistics', statistics)
    app.logger.info(f'Finish loading the statistics data into redis.')
