import click
import copy
import hashlib
import importlib
import io
import json
import logging
import math
import os
import sentry_sdk
import uuid

from flask import g, request

from marshmallow.exceptions import ValidationError

from sqlalchemy import inspect, Table
from sqlalchemy.sql.expression import and_, text
from sqlalchemy.exc import IntegrityError

from neo4japp.constants import LogEventType
from neo4japp.database import db, get_account_service, get_elastic_service, get_file_type_service
from neo4japp.factory import create_app
from neo4japp.lmdb_manager import LMDBManager, AzureStorageProvider
from neo4japp.models import (
    AppUser,
    OrganismGeneMatch,
)
from neo4japp.models.files import FileAnnotationsVersion, AnnotationChangeCause, FileContent, Files
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


# NOTE DEPRECATED: Files.file_id no longer exist -> Files.content_id
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
    lmdb_dir_path = os.path.join(app.***ARANGO_USERNAME***_path, 'services/annotations/lmdb')
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
    lmdb_dir_path = os.path.join(app.***ARANGO_USERNAME***_path, 'services/annotations/lmdb')
    manager.upload_all(lmdb_dir_path)


@app.cli.command('merge-maps')
@click.option('--user-id', '-u', required=True, type=int)
@click.option('--parent-id', '-p', required=True, type=int)
@click.option('--maps', '-m', multiple=True, type=int)
@click.option('--filename', '-f', required=True, type=str)
@click.option('--description', '-d', required=False, type=str)
def merge_maps(user_id, filename, description, parent_id, maps):
    """
    Merges two or more existing drawing tool maps into a single map.

    Args:
        user-id - ID of the user who will own the new map
        parent-id - ID of the folder the new map should be added to
        maps - IDs of two or more maps to merge (e.g. -m 1 -m 2 -m 3)
        filename - Name of the new map
        description - Description of the new map (Optional)
    """
    if maps is None or len(maps) < 2:
        raise ValueError('Should give at least 2 maps to merge.')

    # TODO: Should make sure the given user has access to each of the given maps, and to the given
    # project. This would involve getting the projects of each of the maps. Until this is done we
    # should be careful to make sure we aren't creating any maps in the wrong place, or giving the
    # wrong person access.

    def generate_node_detail_hash(node):
        # Treat notes/links/maps as unique for now
        if node['label'] == 'note' or node['label'] == 'link' or node['label'] == 'map':
            return hashlib.sha256(bytes(str(uuid.uuid4()), 'utf-8')).hexdigest()
        str_to_hash = (node['label'] + '_' + node['display_name']).lower()
        return hashlib.sha256(bytes(str_to_hash, 'utf-8')).hexdigest()

    def get_min_max_x_y_of_maps(maps):
        min_max_x_y_map = {}

        for m in maps:
            min_x = math.inf
            min_y = math.inf
            max_x = -1 * math.inf
            max_y = -1 * math.inf
            for node in m['nodes']:
                x = node['data']['x']
                y = node['data']['y']
                height = node['data'].get('height', 25)
                width = node['data'].get('width', 25)

                if x - (width / 2) < min_x:
                    min_x = x - (width / 2)
                if x + (width / 2) > max_x:
                    max_x = x + (width / 2)
                if y - (height / 2) < min_y:
                    min_y = y - (height / 2)
                if y + (height / 2) > max_y:
                    max_y = y + (height / 2)

            min_max_x_y_map[m['name']] = [[min_x, min_y], [max_x, max_y]]
        return min_max_x_y_map

    def get_max_width_and_height_of_maps(min_max_x_y_map):
        max_width = 0
        max_height = 0

        for min_max_x_y in min_max_x_y_map.values():
            min_x, min_y = min_max_x_y[0]
            max_x, max_y = min_max_x_y[1]

            if max_x - min_x > max_width:
                max_width = max_x - min_x
            if max_y - min_y > max_height:
                max_height = max_y - min_y

        return max_width, max_height

    def combine_maps(maps, sector_width, sector_height, min_max_x_y_map):
        combined_nodes = []
        combined_edges = []

        map_dict = {}

        for m in maps:
            map_dict[m['name']] = {
                'nodes': m['nodes'],
                'edges': m['edges']
            }

        map_origin_dict = {}

        y_multiplier = 0
        for i, m in enumerate(map_dict.keys()):
            # Alternate sides of the x-axis every map. E.g., first map is left of the "true" origin,
            # second map right, third left, etc...
            x_multiplier = 1 if (i + 1) % 2 == 0 else -1

            new_origin = [
                x_multiplier * math.ceil(sector_width / 2),
                y_multiplier * math.ceil(sector_height),
            ]
            map_origin_dict[m] = new_origin

            if (i + 1) % 2 == 0:
                # We want two columns of maps, so increase the y value every third map
                y_multiplier += 1

        for m in map_dict:
            new_origin = map_origin_dict[m]
            min_x, min_y = min_max_x_y_map[m][0]
            max_x, max_y = min_max_x_y_map[m][1]
            center_of_map = [(max_x - min_x) / 2, (max_y - min_y) / 2]
            for node in map_dict[m]['nodes']:
                # First, translate the node as if 0, 0 were the center of the map. This normalizes
                # the positions of all maps. Then, translate the node according to the new origin
                # we calculated earlier.
                node['data']['x'] = node['data']['x'] + (-1 * center_of_map[0]) + new_origin[0]
                node['data']['y'] = node['data']['y'] + (-1 * center_of_map[1]) + new_origin[1]
                combined_nodes.append(node)
            for edge in map_dict[m]['edges']:
                combined_edges.append(edge)

        return {
            'nodes': combined_nodes,
            'edges': combined_edges,
        }

    def merge_maps(maps):
        min_max_x_y_map = get_min_max_x_y_of_maps(maps)
        sector_width, sector_height = get_max_width_and_height_of_maps(min_max_x_y_map)

        # Add a slight horizontal/vertical margin between maps
        sector_width += 500
        sector_height += 1000

        combined_map = combine_maps(maps, sector_width, sector_height, min_max_x_y_map)

        # "node hash" here means the "hash" property of the node objects
        node_detail_hash_to_node_hash_map = {}
        old_hash_to_new_hash_map = {}
        merge_nodes = set()
        hash_to_node_map = {}
        for node in combined_map['nodes']:
            node_hash = node['hash']

            node_detail_hash = generate_node_detail_hash(node)
            hash_to_node_map[node_hash] = node
            # If this is the first time we've encountered this node detail hash,
            # treat the node as the "source of truth" for the merge
            if node_detail_hash not in node_detail_hash_to_node_hash_map:
                node_detail_hash_to_node_hash_map[node_detail_hash] = node_hash
            # If we have seen this node detail hash, map the duplicate node to the detail hash
            else:
                new_hash = node_detail_hash_to_node_hash_map[node_detail_hash]
                merge_nodes.add(new_hash)
                old_hash_to_new_hash_map[node_hash] = new_hash

        # Replace merged nodes locations with the center of the network. May uncomment this on a
        # case-by-case basis.
        # network_center_y = (
        #     ((math.floor((len(maps) - 1) / 2) + 1) * (sector_height / 2)) + (sector_height / 2)
        # ) / 2
        # for i, merge_node_hash in enumerate(merge_nodes):
        #     x_multiplier = 1 if (i + 1) % 2 == 0 else -1
        #     y_modifier = i * 50
        #     hash_to_node_map[merge_node_hash]['data']['x'] = 200 * x_multiplier
        #     hash_to_node_map[merge_node_hash]['data']['y'] = network_center_y + y_modifier

        edges = []
        for edge in combined_map['edges']:
            edge_copy = copy.deepcopy(edge)
            source = edge['from']
            target = edge['to']

            # If source is a duplicate node, replace it with the "true" node
            if source in old_hash_to_new_hash_map:
                edge_copy['from'] = old_hash_to_new_hash_map[source]
            # If target is a duplicate node, replace it with the "true" node
            if target in old_hash_to_new_hash_map:
                edge_copy['to'] = old_hash_to_new_hash_map[target]

            edges.append(edge_copy)

        nodes = []
        for node in combined_map['nodes']:
            if node['hash'] not in old_hash_to_new_hash_map:
                nodes.append(node)

        return {
            'nodes': nodes,
            'edges': edges
        }

    user = db.session.query(AppUser).filter(AppUser.id == user_id).one()
    parent = db.session.query(Files).filter(Files.id == parent_id).one()
    raw_map_data = [
        [json.loads(raw_data[0]), raw_data[1]]
        for raw_data in db.session.query(
            FileContent.raw_file,
            Files.filename
        ).join(
            Files,
            and_(
                Files.content_id == FileContent.id,
                Files.id.in_(maps)
            )
        ).all()
    ]
    map_data = [
        {
            'name': filename,
            'nodes': file_data['nodes'],
            'edges': file_data['edges']
        } for file_data, filename in raw_map_data
    ]

    file_type_service = get_file_type_service()

    file = Files()
    file.filename = filename or 'New Merged Map'
    file.description = description or ''
    file.user = user
    file.creator = user
    file.modifier = user
    file.public = False
    file.parent = parent
    file.upload_url = None
    file.mime_type = 'vnd.***ARANGO_DB_NAME***.document/map'

    # Create operation
    buffer = io.BytesIO(json.dumps(merge_maps(map_data)).encode('utf-8'))

    # Figure out file size
    buffer.seek(0, io.SEEK_END)
    size = buffer.tell()
    buffer.seek(0)

    # Check max file size
    if size > 1024 * 1024 * 300:
        raise ValidationError(
            'Your file could not be processed because it is too large.')

    # Get the provider based on what we know now
    provider = file_type_service.get(file)

    # Check if the user can even upload this type of file
    if not provider.can_create():
        raise ValidationError(f"The provided file type is not accepted.")

    # Validate the content
    try:
        provider.validate_content(buffer)
        buffer.seek(0)  # Must rewind
    except ValueError as e:
        raise ValidationError(f"The provided file may be corrupt: {str(e)}")

    # Get the DOI
    file.doi = provider.extract_doi(buffer)
    buffer.seek(0)  # Must rewind

    # Save the file content if there's any
    if size:
        file.content_id = FileContent.get_or_create(buffer)
        buffer.seek(0)  # Must rewind

    # ========================================
    # Commit and filename conflict resolution
    # ========================================

    # Filenames could conflict, so we may need to generate a new filename
    # Trial 1: First attempt
    # Trial 2: Try adding (N+1) to the filename and try again
    # Trial 3: Try adding (N+1) to the filename and try again (in case of a race condition)
    # Trial 4: Give up
    # Trial 3 only does something if the transaction mode is in READ COMMITTED or worse (!)
    for trial in range(4):
        if 1 <= trial <= 2:  # Try adding (N+1)
            try:
                file.filename = file.generate_non_conflicting_filename()
            except ValueError:
                raise ValidationError(
                    'Filename conflicts with an existing file in the same folder.',
                    "filename")
        elif trial == 3:  # Give up
            raise ValidationError(
                'Filename conflicts with an existing file in the same folder.',
                "filename")

        try:
            db.session.begin_nested()
            db.session.add(file)
            db.session.commit()
            break
        except IntegrityError as e:
            # Warning: this could catch some other integrity error
            db.session.rollback()

    db.session.commit()
