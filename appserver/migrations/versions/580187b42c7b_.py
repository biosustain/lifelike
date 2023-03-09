"""Remove duplicate maps

Revision ID: 580187b42c7b
Revises: fbfb28a836c6
Create Date: 2022-08-23 23:46:45.306680

"""
from alembic import context, op
import hashlib
import io
import json
import sqlalchemy as sa
import zipfile

# flake8: noqa: OIG001 # It is legacy file with imports from appserver which we decided to not fix
from neo4japp.constants import FILE_MIME_TYPE_MAP


# revision identifiers, used by Alembic.
revision = "580187b42c7b"
down_revision = "fbfb28a836c6"
branch_labels = None
depends_on = None


def upgrade():
    if context.get_x_argument(as_dictionary=True).get("data_migrate", None):
        op.drop_constraint(
            op.f("fk_files_content_id_files_content"), "files", type_="foreignkey"
        )
        op.drop_constraint(
            op.f("fk_file_version_content_id_files_content"),
            "file_version",
            type_="foreignkey",
        )
        op.drop_constraint(
            op.f("fk_global_list_file_id_files_content"),
            "global_list",
            type_="foreignkey",
        )

        data_upgrades()

        op.create_foreign_key(
            op.f("fk_files_content_id_files_content"),
            "files",
            "files_content",
            ["content_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_foreign_key(
            op.f("fk_file_version_content_id_files_content"),
            "file_version",
            "files_content",
            ["content_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_foreign_key(
            op.f("fk_global_list_file_id_files_content"),
            "global_list",
            "files_content",
            ["file_content_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade():
    pass


def data_upgrades():
    """Add optional data upgrade migrations here"""
    conn = op.get_bind()

    t_files = sa.Table(
        "files",
        sa.MetaData(),
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("mime_type"),
        sa.Column("content_id", sa.VARCHAR()),
    )

    t_file_version = sa.Table(
        "file_version",
        sa.MetaData(),
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("file_id", sa.VARCHAR()),
        sa.Column("content_id", sa.VARCHAR()),
    )

    t_global_list = sa.Table(
        "global_list",
        sa.MetaData(),
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("file_content_id", sa.VARCHAR()),
    )

    t_files_content = sa.Table(
        "files_content",
        sa.MetaData(),
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("raw_file", sa.VARCHAR()),
        sa.Column("checksum_sha256"),
    )

    raw_maps_to_fix = conn.execution_options(
        stream_results=True, max_buffer_rows=25
    ).execute(
        sa.select([t_files_content.c.id, t_files_content.c.raw_file]).where(
            t_files_content.c.id.in_(
                sa.union(
                    # This will get the ids of all old file content versions
                    sa.select([t_file_version.c.content_id]).select_from(
                        t_file_version.join(
                            t_files,
                            sa.and_(
                                t_files.c.mime_type == FILE_MIME_TYPE_MAP,
                                t_file_version.c.file_id == t_files.c.id,
                            ),
                        )
                    ),
                    # This will get all current content version ids
                    sa.select([t_files.c.content_id]).select_from(
                        t_files_content.join(
                            t_files,
                            sa.and_(
                                t_files.c.mime_type == FILE_MIME_TYPE_MAP,
                                t_files.c.content_id == t_files_content.c.id,
                            ),
                        )
                    ),
                )
            )
        )
    )

    checksum_map = {}
    for fcid, raw_file in raw_maps_to_fix:
        zip_file = zipfile.ZipFile(io.BytesIO(raw_file))
        map_json = json.loads(zip_file.read("graph.json"))
        byte_graph = json.dumps(map_json, separators=(",", ":")).encode("utf-8")

        new_zip_bytes = io.BytesIO()
        with zipfile.ZipFile(
            new_zip_bytes, "w", zipfile.ZIP_DEFLATED, strict_timestamps=False
        ) as new_zip:
            new_zip.writestr(zipfile.ZipInfo("graph.json"), byte_graph)

            # Make sure to copy the image bytes into the hash object as well
            for node in map_json["nodes"]:
                if node.get("image_id", None):
                    image_name = "".join(["images/", node.get("image_id"), ".png"])
                    try:
                        image_bytes = zip_file.read(image_name)
                        new_zip.writestr(zipfile.ZipInfo(image_name), image_bytes)
                    except KeyError:
                        # For some reason there was a node with an image id, but no corresponding
                        # image file
                        continue

        checksum = hashlib.sha256(new_zip_bytes.getvalue()).hexdigest()

        if checksum in checksum_map:
            checksum_map[checksum].add(fcid)
        else:
            checksum_map[checksum] = {fcid}

    files_content_to_delete = []
    for ids in checksum_map.values():
        if len(ids) > 1:
            oldest_file = min(ids)
            duplicate_files = [id for id in ids if id != oldest_file]
            files_content_to_delete += duplicate_files

            # Remove references to duplicates in the files table
            conn.execute(
                sa.update(t_files)
                .where(t_files.c.content_id.in_(duplicate_files))
                .values(content_id=oldest_file)
            )

            # Remove references to duplicates in the file_version table
            conn.execute(
                sa.update(t_file_version)
                .where(t_file_version.c.content_id.in_(duplicate_files))
                .values(content_id=oldest_file)
            )

            # Remove references to duplicates in the global_list table
            conn.execute(
                sa.update(t_global_list)
                .where(t_global_list.c.file_content_id.in_(duplicate_files))
                .values(file_content_id=oldest_file)
            )

    # Remove duplicate file contents
    conn.execute(
        sa.delete(t_files_content).where(
            t_files_content.c.id.in_(files_content_to_delete)
        )
    )
