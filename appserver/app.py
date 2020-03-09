import jwt
import json
import os
from flask import render_template
from flask_cors import CORS
from sqlalchemy.sql.expression import text

from neo4japp.database import db
from neo4japp.factory import create_app
from neo4japp.models.drawing_tool import AppUser, Project

app_config = os.environ['FLASK_APP_CONFIG']
app = create_app(config=f'config.{app_config}')

CORS(app)

@app.route('/')
def home():
    return render_template('index.html')

@app.cli.command("seed")
def seed():
    """
        Seed the postgres db for development
    """
    with open("fixtures/seed.json", "r") as f:
        
        fixtures = json.load(f)

        for fix in fixtures:

            if fix["table"] == "appuser":
                for r in fix["records"]:
                    user = AppUser(
                        username=r["username"],
                        email=r["email"],
                        password_hash=r["password_hash"]
                    )
                    db.session.add(user)
                    db.session.commit()
            elif fix["table"] == "project":
                for r in fix["records"]:
                    proj = Project(
                        label=r["label"],
                        description=r["description"],
                        date_modified=r["date_modified"],
                        graph=r["graph"],
                        # temporary fix
                        user_id=1
                    )
                    db.session.add(proj)
                    db.session.commit()


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
