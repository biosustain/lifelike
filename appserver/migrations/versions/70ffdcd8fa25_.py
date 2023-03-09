"""LL-3296: Fix annotation related data to have correct standardized sources text

Revision ID: 70ffdcd8fa25
Revises: 6a8b231f65b9
Create Date: 2021-07-09 20:12:43.183377

"""
from alembic import context
from alembic import op
import sqlalchemy as sa

from sqlalchemy.sql import table, column
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm.session import Session

from migrations.utils import window_chunk

# flake8: noqa: OIG001 # It is legacy file with imports from appserver which we decided to not fix
from neo4japp.models import Files, GlobalList
from neo4japp.services.annotations.constants import DatabaseType

# revision identifiers, used by Alembic.
revision = "70ffdcd8fa25"
down_revision = "6a8b231f65b9"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # ### end Alembic commands ###
    if context.get_x_argument(as_dictionary=True).get("data_migrate", None):
        data_upgrades()


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    pass
    # ### end Alembic commands ###
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()
    session = Session(conn)

    db_sources = {
        "CHEBI": DatabaseType.CHEBI.value,
        "MESH": DatabaseType.MESH.value,
        "BIOCYC": DatabaseType.BIOCYC.value,
        "UNIPROT": DatabaseType.UNIPROT.value,
        "NCBI Gene": DatabaseType.NCBI_GENE.value,
        "NCBI Species": DatabaseType.NCBI_TAXONOMY.value,
        "PUBCHEM": DatabaseType.PUBCHEM.value,
    }

    tableclause1 = table(
        "files",
        column("id", sa.Integer),
        column("annotations", postgresql.JSONB),
        column("custom_annotations", postgresql.JSONB),
    )

    files = conn.execution_options(stream_results=True).execute(
        sa.select([tableclause1.c.id, tableclause1.c.custom_annotations]).where(
            tableclause1.c.custom_annotations != "[]"
        )
    )

    """Setting window chunk to 1 because we were having OOM issues
    since the JSONs can be very big (on PROD)
    """

    for chunk in window_chunk(files, 1):
        need_to_update = []
        for fid, custom in chunk:
            new_customs = []
            for c in custom:
                if c["meta"]["idType"]:
                    anno_type = c["meta"]["type"]
                    if anno_type == "Gene" or anno_type == "Species":
                        key = f"NCBI {anno_type}"
                    else:
                        key = c["meta"]["idType"]

                    try:
                        c["meta"]["idType"] = db_sources[key]
                    except KeyError:
                        # ignore wrong ones that are not what we expect
                        # probably from testing or something...
                        continue
                    new_customs.append(c)
            need_to_update.append({"id": fid, "custom_annotations": new_customs})
        try:
            session.bulk_update_mappings(Files, need_to_update)
            session.commit()
        except Exception:
            session.rollback()
            raise

    files = conn.execution_options(stream_results=True).execute(
        sa.select([tableclause1.c.id, tableclause1.c.annotations]).where(
            tableclause1.c.annotations != "[]"
        )
    )

    for chunk in window_chunk(files, 1):
        need_to_update = []
        for fid, annotations_json in chunk:
            new_annotations = []

            if type(annotations_json) is list:
                # stage has bad data from previous bad implementation
                annotations = annotations_json[0]["documents"][0]["passages"][0][
                    "annotations"
                ]
            else:
                try:
                    annotations = annotations_json["documents"][0]["passages"][0][
                        "annotations"
                    ]
                except Exception:
                    # odd that the where clause above failed to filter this out
                    # is it possible '[]' in an update is different from default '[]'?
                    # TODO: need new JIRA card to make a new NULLABLE annotations
                    # column and copy the annotations over
                    if annotations_json == "[]":
                        continue

            for annotation in annotations:
                anno_type = annotation["meta"]["type"]
                if anno_type == "Gene" or anno_type == "Species":
                    key = f"NCBI {anno_type}"
                else:
                    key = annotation["meta"]["idType"]

                try:
                    annotation["meta"]["idType"] = db_sources[key]
                except KeyError:
                    # ignore wrong ones that are not what we expect
                    # probably from testing or something...
                    continue
                new_annotations.append(annotation)

            if type(annotations_json) is list:
                # stage has bad data from previous bad implementation
                annotations_json[0]["documents"][0]["passages"][0][
                    "annotations"
                ] = new_annotations  # noqa
            else:
                annotations_json["documents"][0]["passages"][0][
                    "annotations"
                ] = new_annotations
            need_to_update.append({"id": fid, "annotations": annotations_json})
        try:
            session.bulk_update_mappings(Files, need_to_update)
            session.commit()
        except Exception:
            session.rollback()
            raise

    ####################
    # update globals now
    ####################

    tableclause2 = table(
        "global_list",
        column("id", sa.Integer),
        column("type", sa.String),
        column("annotation", postgresql.JSONB),
    )

    globals = conn.execution_options(stream_results=True).execute(
        sa.select([tableclause2.c.id, tableclause2.c.annotation]).where(
            tableclause2.c.type == "inclusion"
        )
    )

    for chunk in window_chunk(globals, 1):
        need_to_update = []
        for gid, inclusion in chunk:
            if inclusion["meta"]["idType"]:
                anno_type = inclusion["meta"]["type"]
                if anno_type == "Gene" or anno_type == "Species":
                    key = f"NCBI {anno_type}"
                else:
                    key = inclusion["meta"]["idType"]

                try:
                    inclusion["meta"]["idType"] = db_sources[key]
                except KeyError:
                    # ignore wrong ones that are not what we expect
                    # probably from testing or something...
                    continue
                need_to_update.append({"id": gid, "annotation": inclusion})
        try:
            session.bulk_update_mappings(GlobalList, need_to_update)
            session.commit()
        except Exception:
            session.rollback()
            raise


def data_downgrades():
    """Add optional data downgrade migrations here"""
    pass
