"""migrate annotations with empty string id

Revision ID: 6d4adebe79eb
Revises: ab0d6b3ef77a
Create Date: 2022-10-17 12:43:49.291918

"""
import sqlalchemy as sa
from alembic import context
from alembic import op
from sqlalchemy import table, column, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session
from sqlalchemy.sql.expression import func

from migrations.utils import window_chunk

# revision identifiers, used by Alembic.
revision = "6d4adebe79eb"
down_revision = "ab0d6b3ef77a"
branch_labels = None
depends_on = None

t_files = table(
    "files",
    column("id", Integer),
    column("custom_annotations", JSONB),
    column("excluded_annotations", JSONB),
)

t_file_annotation_versions = table(
    "file_annotations_version",
    column("creation_date", sa.TIMESTAMP(timezone=True)),
    column("modified_date", sa.TIMESTAMP(timezone=True)),
    column("hash_id", sa.String(length=36)),
    column("id", sa.Integer()),
    column("file_id", sa.Integer()),
    column(
        "cause",
        sa.Enum(
            "USER", "USER_REANNOTATION", "SYSTEM_REANNOTATION", name="annotationcause"
        ),
    ),
    column("custom_annotations", JSONB(astext_type=Text())),
    column("excluded_annotations", JSONB(astext_type=Text())),
    column("user_id", sa.Integer()),
)


def upgrade():
    if context.get_x_argument(as_dictionary=True).get("data_migrate", None):
        data_upgrades()


def downgrade():
    pass
    # NOTE: In practice perfect downgrades are difficult and in some cases
    # impossible! It is more practical to use database backups/snapshots to
    # "downgrade" the database. Changes to the database that we intend to
    # push to production should always be added to a NEW migration.
    # (i.e. "downgrade forward"!)


def fix_annotation_id(annotation):
    meta = annotation["meta"]
    id = meta["id"]
    if not id:
        allText = meta["allText"]
        if meta["isCaseInsensitive"]:
            allText = allText.lower()
        id = f"{allText}_{meta['type']}"
        return {**annotation, "meta": {**meta, "id": id}}


def process_result_value(value):
    return list(map(fix_annotation_id, value))


def update_annotation_list(annotations):
    updated_annotations = process_result_value(annotations)
    if any(updated_annotations):
        return list(
            map(
                lambda zipped: zipped[1] or zipped[0],
                zip(annotations, updated_annotations),
            )
        )


def update_annotations(custom_annotations):
    updated_custom_annotations = update_annotation_list(custom_annotations)
    if updated_custom_annotations:
        return {"custom_annotations": updated_custom_annotations}


def iterate_files_with_customised_annotations(updateCallback):
    conn = op.get_bind()
    session = Session(conn)

    files = conn.execution_options(stream_results=True).execute(
        sa.select([t_files.c.id, t_files.c.custom_annotations]).where(
            func.jsonb_array_length(t_files.c.custom_annotations) > 0
        )
    )

    for chunk in window_chunk(files, 25):
        for file_id, custom_annotations in chunk:
            update = updateCallback(custom_annotations)
            if update:
                session.execute(
                    t_files.update().where(t_files.c.id == file_id).values(**update)
                )
                session.flush()
    session.commit()


def data_upgrades():
    iterate_files_with_customised_annotations(update_annotations)


def data_downgrades():
    pass
