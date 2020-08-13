import importlib
import json
import logging
import os

import click
from sqlalchemy import MetaData, inspect, Table
from sqlalchemy.sql.expression import text

from neo4japp.database import db, get_account_service
from neo4japp.factory import create_app
from neo4japp.models import (
    AppUser,
    OrganismGeneMatch,
)

app_config = os.environ['FLASK_APP_CONFIG']
app = create_app(config=f'config.{app_config}')
logger = logging.getLogger(__name__)


@app.route('/')
def home():
    return 'Ouch! You hit me.'


@app.cli.command("seed")
def seed():
    logger.info("Clearing database of data...")
    meta = MetaData(bind=db.engine, reflect=True)
    con = db.engine.connect()
    trans = con.begin()
    for table in meta.sorted_tables:
        # don't want to truncate annotation stop words table
        # because data was inserted in migration
        # since it's needed on server when deployed
        if table.name != 'annotation_stop_words' and table.name != 'alembic_version':
            con.execute(f'ALTER TABLE "{table.name}" DISABLE TRIGGER ALL;')
            con.execute(f'TRUNCATE TABLE "{table.name}" RESTART IDENTITY CASCADE;')
            con.execute(f'ALTER TABLE "{table.name}" ENABLE TRIGGER ALL;')
    trans.commit()

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

        for fixture in fixtures:
            module_name, class_name = fixture['model'].rsplit('.', 1)
            module = importlib.import_module(module_name)
            model = getattr(module, class_name)

            if isinstance(model, Table):
                db.session.execute(model.insert(), fixture['records'])
            else:
                model_meta = inspect(model)
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
    from neo4japp.services.indexing import index_pdf
    print('Seeds elasticsearch with PDF indexes')
    index_pdf.seed_elasticsearch()
