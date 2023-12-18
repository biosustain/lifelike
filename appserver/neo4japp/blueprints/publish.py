import hashlib
from os import path
from typing import List, cast
from uuid import uuid4

from flask import Blueprint, g, request
from flask.views import MethodView

from neo4japp.constants import FILE_MIME_TYPE_DIRECTORY
from neo4japp.database import get_file_type_service, db
from neo4japp.exceptions import ServerWarning
from neo4japp.models import Files
from neo4japp.services.file_types.data_exchange import DataExchange
from neo4japp.services.filesystem import Filesystem
from neo4japp.utils import make_cacheable_file_response
from neo4japp.utils.globals import warn
from neo4japp.utils.sqlalchemy import ensure_detached

bp = Blueprint('publish', __name__, url_prefix='/publish')


class PrePublishView(MethodView):
    def post(self, hash_id: str):
        """Pre-publish endpoint.
        This aligns with file export endpoint,
         just with equired additional hierarchy manipulations.
        """
        current_user = g.current_user

        target_file = Filesystem.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        Filesystem.check_file_permissions(
            [target_file], current_user, ['readable'], permit_recycled=True
        )

        file_type_service = get_file_type_service()
        file_type = file_type_service.get(target_file.mime_type)

        # To prevent leaking changes to the database, we use a savepoint
        savepoint = db.session.begin_nested()

        try:
            # region READING RELATED FILES
            # LL - 5375: limiting publishing options so it is rolloutable
            # related = set(
            #     cast(
            #         List[Files],
            #         file_type.get_related_files(target_file, recursive=set()),
            #     )
            # )
            related = set(
                cast(
                    List[Files],
                    file_type.get_related_files(target_file, recursive=None),
                )
            )

            common_path = (
                path.commonpath([target_file.path] + [f.path for f in related])
                if len(related)
                else ''
            )

            # Flattern inbetween folders to preserve file hierarhy in export
            # (generate_export() exports only files in the list)
            common_path_len = len(common_path)

            def add_parent(_related_file: Files):
                if (
                        _related_file.parent
                        and len(_related_file.parent.path) > common_path_len
                ):
                    related.add(_related_file.parent)
                    add_parent(_related_file.parent)

            for related_file in related.copy():
                add_parent(related_file)

            # Check read permissions
            def has_read_permission(_related_file: Files):
                if _related_file.calculated_privileges[current_user.id].readable:
                    return True

                warn(
                    ServerWarning(
                        title='Skipped non-readable file',
                        message=f'User {current_user.username} has sufficient permissions'
                                f' to read "{_related_file.path}".',
                    )
                )

            permited_related_files = list(filter(has_read_permission, related))  # type: ignore
            # endregion

            # region UPDATING FILE HIERARCHY FOR PUBLICATION
            # Detach from the session to prevent changes to the database
            if target_file.mime_type != FILE_MIME_TYPE_DIRECTORY:
                # noinspection PyStatementEffect
                target_file.content  # Trigger lazy load of content
            ensure_detached(target_file, db.session)
            for file in permited_related_files:
                if file.mime_type != FILE_MIME_TYPE_DIRECTORY:
                    # noinspection PyStatementEffect
                    file.content  # Trigger lazy load of content
                ensure_detached(file, db.session)
            # now on files are in detached state

            # Rename project ***ARANGO_USERNAME*** folder to project name
            for file in permited_related_files:
                if file.filename == '/':
                    file.filename = file.project.name

            filename = (
                target_file.filename
                if target_file.filename != '/'
                else target_file.project.name
            )

            # Find files that are related to the target but not within it (e.g. folder)
            separate_branch_related_files = []
            same_branch_related_files = []
            for f in permited_related_files:
                if f.path.startswith(target_file.path):
                    same_branch_related_files.append(f)
                else:
                    separate_branch_related_files.append(f)

            if separate_branch_related_files:
                # If there are such files, we need to create a folder for them
                # and move them there
                related_folder_filename = 'related files'
                if target_file.mime_type != FILE_MIME_TYPE_DIRECTORY:
                    if related_folder_filename == filename:
                        related_folder_filename += str(uuid4())
                else:
                    for file in separate_branch_related_files:
                        if file.filename == related_folder_filename:
                            related_folder_filename += str(uuid4())
                            break

                # Find a vacant id for the folder
                vacant_id = 0
                used_ids = set([f.id for f in permited_related_files + [target_file]])
                while vacant_id in used_ids:
                    vacant_id += 1

                related_folder = Files(
                    id=vacant_id,
                    filename=related_folder_filename,
                    mime_type=FILE_MIME_TYPE_DIRECTORY,
                    creator=current_user,
                    user=current_user,
                    path=f'/{related_folder_filename}',
                )
                permited_related_files.append(related_folder)
                for sbrf in separate_branch_related_files:
                    if sbrf.parent not in separate_branch_related_files:
                        ancestors = [
                            f for f in separate_branch_related_files
                            if f.path.startswith(sbrf.path) and f != sbrf
                        ]
                        path_to_replace = sbrf.path
                        sbrf.parent = related_folder
                        sbrf.parent_id = related_folder.id
                        sbrf.path = path.join(
                            related_folder.path,
                            path.basename(sbrf.path),
                        )

                        # Remap paths to be relative to the folder
                        for ancestor in ancestors:
                            ancestor.path = path.join(
                                sbrf.path,
                                str(path.relpath(ancestor.path, path_to_replace)),
                            )

            target_file.path = f'/{filename}'
            # endregion

            # for sbrf in same_branch_related_files:
            #     sbrf.path = path.join(target_file.path, path.relpath(sbrf.path, common_path))

            if target_file.mime_type != FILE_MIME_TYPE_DIRECTORY:
                files_to_export = list(set([target_file] + permited_related_files))
            else:
                files_to_export = permited_related_files

            export = DataExchange.generate_export(filename, files_to_export, 'zip')
        finally:
            savepoint.rollback()

        export_content = export.content.getvalue()
        checksum_sha256 = hashlib.sha256(export_content).digest()
        # todo: this should support returning operation result status (not only file content)
        return make_cacheable_file_response(
            request,
            export_content,
            etag=checksum_sha256.hex(),
            filename=export.filename,
            mime_type=export.mime_type,
        )


bp.add_url_rule(
    '<string:hash_id>/prepare', view_func=PrePublishView.as_view('file_export')
)
