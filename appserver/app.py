import click
import jwt
import json
import os
from flask import render_template
from sqlalchemy.sql.expression import text
from neo4japp.factory import create_app
from neo4japp.models import AppRole, AppUser, Directory, Project, Projects, OrganismGeneMatch

from neo4japp.database import db, get_account_service

app_config = os.environ['FLASK_APP_CONFIG']
app = create_app(config=f'config.{app_config}')


@app.route('/')
def home():
    return 'Ouch! You hit me.'


@app.cli.command("seed")
def seed():
    """
        Seed the postgres db for development
    """
    account_service = get_account_service()
    with open("fixtures/seed.json", "r") as f:

        fixtures = json.load(f)

        for fix in fixtures:

            if fix["table"] == "appuser":
                for r in fix["records"]:
                    account_service.create_user(
                        username=r["username"],
                        email=r["email"],
                        password=r["password_hash"],
                        roles=["admin"],
                        first_name=r["first_name"],
                        last_name=r["last_name"]
                    )

            elif fix["table"] == "projects":
                for r in fix["records"]:
                    proj = Projects(
                        project_name=r["project_name"],
                        description=r["description"],
                        users=r["users"],
                    )

                    db.session.add(proj)
                    db.session.flush()

                    directory = Directory(
                        name='home',
                        projects_id=proj.id,
                    )

                    db.session.add(directory)
                    db.session.flush()

                    db.session.commit()

            elif fix["table"] == "project":
                for idx, r in enumerate(fix["records"]):
                    r = fix["records"][idx]

                    draw_proj = Project(
                        label=r["label"],
                        description=r["description"],
                        date_modified=r["date_modified"],
                        graph=r["graph"],
                        public=r["public"],
                        author=r["author"],
                        # temporary fix
                        user_id=idx+1,
                        dir_id=db.session.query(Directory).first().id,
                    )

                    db.session.add(draw_proj)
                    db.session.flush()

                    # Assign hash_id to map
                    draw_proj.set_hash_id()

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
            name for (name, ) in db.engine.execute(text(table_sql))
        ]:
            db.engine.execute(text('DROP TABLE "%s" CASCADE' % table))

        # Get and drop all enums
        enum_sql = (
            "SELECT DISTINCT t.typname "
            "FROM pg_catalog.pg_type t "
            "JOIN pg_catalog.pg_enum e ON t.oid = e.enumtypid"
        )
        for enum in [
            name for (name, ) in db.engine.execute(text(enum_sql))
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
