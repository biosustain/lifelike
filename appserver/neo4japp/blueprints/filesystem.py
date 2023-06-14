import hashlib
import itertools
import zipfile
from datetime import datetime, timedelta
from http import HTTPStatus
from typing import List, Dict, Iterable, Literal, Optional, Union
from deepdiff import DeepDiff
from flask import Blueprint, current_app, g, jsonify, make_response, request
from flask.views import MethodView
from marshmallow import ValidationError
from sqlalchemy import and_, desc as desc_, or_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import raiseload, joinedload, aliased, contains_eager
from sqlalchemy.orm.exc import NoResultFound
from webargs.flaskparser import use_args

from neo4japp.constants import (
    FILE_MIME_TYPE_DIRECTORY,
    FILE_MIME_TYPE_MAP,
    LogEventType,
    UPDATE_DATE_MODIFIED_COLUMNS,
    SortDirection,
)
from neo4japp.database import db, get_file_type_service
from neo4japp.exceptions import (
    InvalidArgument,
    RecordNotFound,
    NotAuthorized,
    HandledException,
    ServerException,
)
from neo4japp.exceptions import wrap_exceptions
from neo4japp.models import (
    Files,
    FileContent,
    AppUser,
    FileVersion,
    FileBackup,
)
from neo4japp.models.files import (
    FileLock,
    FileAnnotationsVersion,
    MapLinks,
    StarredFile,
)
from neo4japp.schemas.annotations import FileAnnotationHistoryResponseSchema
from neo4japp.schemas.common import PaginatedRequestSchema, WarningSchema
from neo4japp.schemas.filesystem import (
    BulkFileRequestSchema,
    BulkFileUpdateRequestSchema,
    FileBackupCreateRequestSchema,
    FileCreateRequestSchema,
    FileExportRequestSchema,
    FileHierarchyRequestSchema,
    FileHierarchyResponseSchema,
    FileListSchema,
    FileLockCreateRequest,
    FileLockDeleteRequest,
    FileLockListResponse,
    FileResponseSchema,
    FileSearchRequestSchema,
    FileStarUpdateRequest,
    FileUpdateRequestSchema,
    FileVersionHistorySchema,
    MultipleFileResponseSchema,
)
from neo4japp.services.file_types.exports import ExportFormatError
from neo4japp.services.file_types.providers import DirectoryTypeProvider
from neo4japp.services.file_types.service import FileTypeService
from neo4japp.utils import (
    window,
    make_cacheable_file_response,
    UserEventLog,
)
from neo4japp.utils.file_content_buffer import FileContentBuffer
from .utils import get_missing_hash_ids
from ..services.filesystem import Filesystem

bp = Blueprint('filesystem', __name__, url_prefix='/filesystem')


# When working with files, remember that:
# - They may be recycled
# - They may be deleted
# - The project that the files are in may be recycled


# TODO: Deprecate me after LL-3006
@bp.route('/enrichment-tables', methods=['GET'])
def get_all_enrichment_tables():
    is_admin = g.current_user.has_role('admin')
    if is_admin is False:
        raise NotAuthorized()

    query = db.session.query(Files.hash_id).filter(
        Files.mime_type == 'vnd.***ARANGO_DB_NAME***.document/enrichment-table'
    )
    results = [hash_id[0] for hash_id in query.all()]
    return jsonify(dict(result=results)), HTTPStatus.OK


class FilesystemBaseView(MethodView):
    """
    Base view for filesystem endpoints
    """

    def update_files(
        self,
        target_files: List[Files],
        parent_file: Optional[Files],
        params: Dict,
        user: AppUser,
    ):
        """
        Updates the specified files using the parameters from a validated request.
        :param target_files: the files to update
        :param parent_file: parent file of the files to update
        :param params: the parameters
        :param user: the user that is making the change
        """
        try:
            with db.session.begin_nested():
                # ========================================
                # Check
                # ========================================
                files_to_check = target_files[
                    :
                ]  # Makes a copy of target_files so we don't mutate it
                if parent_file is not None:
                    # Prevent recursive parent hash IDs
                    if parent_file.hash_id in [file.hash_id for file in target_files]:
                        raise ValidationError(
                            f'An object cannot be set as the parent of itself.',
                            'parentHashId',
                        )

                    # Check the specified parent to see if it can even be a parent
                    if parent_file.mime_type != DirectoryTypeProvider.MIME_TYPE:
                        raise ValidationError(
                            f'The specified parent ({parent_file.hash_id}) is '
                            f'not a folder. It is a file, and you cannot make files '
                            f'become a child of another file.',
                            'parentHashId',
                        )
                    files_to_check.append(parent_file)

                Filesystem.check_file_permissions(
                    files_to_check, user, ['writable'], permit_recycled=False
                )

                if 'content_value' in params and len(target_files) > 1:
                    # We don't allow multiple files to be changed due to a potential deadlock
                    # in FileContent.get_or_create(), and also because it's a weird use case
                    raise NotImplementedError(
                        "Cannot update the content of multiple files with this method"
                    )

                # ========================================
                # Apply
                # ========================================
                file_type_service = get_file_type_service()
                update_modified_date = any(
                    [param in UPDATE_DATE_MODIFIED_COLUMNS for param in params]
                )

                for file in target_files:
                    assert file.calculated_project is not None
                    is_***ARANGO_USERNAME***_dir = file.calculated_project.***ARANGO_USERNAME***_id == file.id

                    if 'description' in params:
                        if file.description != params['description']:
                            file.description = params['description']

                    # Some changes cannot be applied to ***ARANGO_USERNAME*** directories
                    if not is_***ARANGO_USERNAME***_dir:
                        if parent_file is not None:
                            # Re-check referential parent
                            if file.id == parent_file.id:
                                raise ValidationError(
                                    f'A file or folder ({file.filename}) cannot be '
                                    f'set as the parent of itself.',
                                    "parentHashId",
                                )

                            # TODO: Check max hierarchy depth

                            # Check for circular inheritance
                            current_parent = parent_file.parent
                            while current_parent:
                                if current_parent.hash_id == file.hash_id:
                                    raise ValidationError(
                                        f"If the parent of '{file.filename}' was set to "
                                        f"'{parent_file.filename}', it would result in circular"
                                        f"inheritance.",
                                        "parent_hash_id",
                                    )
                                current_parent = current_parent.parent

                            file.parent_id = parent_file.id

                        if 'filename' in params:
                            file.filename = params['filename']

                        if 'public' in params:
                            # Directories can't be public because it doesn't work right in all
                            # places yet (namely not all API endpoints that query for public files
                            # will pick up files within a public directory)
                            if (
                                file.mime_type != DirectoryTypeProvider.MIME_TYPE
                                and file.public != params['public']
                            ):
                                file.public = params['public']

                        if 'pinned' in params:
                            file.pinned = params['pinned']

                if 'contexts' in params:
                    file.contexts = params['contexts']

                        if 'fallback_organism' in params:
                            if params['fallback_organism'] is None:
                                file.organism_name = None
                                file.organism_synonym = None
                                file.organism_taxonomy_id = None
                            else:
                                try:
                                    file.organism_name = params['fallback_organism'][
                                        'organism_name'
                                    ]
                                    file.organism_synonym = params['fallback_organism'][
                                        'synonym'
                                    ]
                                    file.organism_taxonomy_id = params[
                                        'fallback_organism'
                                    ]['tax_id']
                                except KeyError as e:
                                    raise InvalidArgument(
                                        message=(
                                            'You must provide the following properties for a '
                                            + 'fallback organism: '
                                            '"organism_name", "synonym", "tax_id".'
                                        )
                                    ) from e

                        if 'annotation_configs' in params:
                            file.annotation_configs = params['annotation_configs']

                        if 'content_value' in params:
                            buffer = FileContentBuffer(
                                stream=params['content_value'].stream
                            )

                            # Get file size
                            size = buffer.size

                            if size > Filesystem.file_max_size:
                                raise ValidationError(
                                    'Your file could not be processed because it is too large.',
                                    "content_value",
                                )

                            # Get the provider
                            provider = file_type_service.get(file.mime_type)
                            buffer = provider.prepare_content(buffer, params, file)
                            try:
                                provider.validate_content(
                                    buffer, log_status_messages=True
                                )
                            except ValueError as e:
                                raise ValidationError(
                                    f"The provided file may be corrupt for files of type "
                                    f"'{file.mime_type}' (which '{file.hash_id}' is of).",
                                    "contentValue",
                                ) from e
                            except HandledException:
                                pass

                            new_content = FileContent.get_or_create(buffer)

                            # Only make a file version if the content actually changed
                            if file.content != new_content:
                                # Create file version
                                version = FileVersion()
                                version.file = file
                                version.content_id = file.content_id
                                version.user = user
                                db.session.add(version)

                                file.content = new_content
                                provider.handle_content_update(file)
                    file.modifier = user
                    if update_modified_date:
                        # TODO: Ideally, we would let the ORM handle this.
                        #  However, our tests need to be updated with
                        #  proper transaction management first.
                        file.modified_date = datetime.now()

        except IntegrityError as e:
            raise ValidationError(
                "No two items (folder or file) can share the same name.", "filename"
            ) from e


class FileHierarchyView(FilesystemBaseView):
    @use_args(FileHierarchyRequestSchema)
    def get(self, params: dict):
        """
        Fetches a representation of the complete file hierarchy accessible by the current user.
        """
        current_app.logger.info(
            f'Attempting to generate file hierarchy...',
            extra=UserEventLog(
                username=g.current_user.username,
                event_type=LogEventType.FILESYSTEM.value,
            ).to_dict(),
        )

        filters = [Files.recycling_date.is_(None)]

        if params['directories_only']:
            filters.append(Files.mime_type == DirectoryTypeProvider.MIME_TYPE)

        hierarchy = Filesystem.get_nondeleted_recycled_files(
            and_(*filters),
            # Ordering by both project name and file path ensures hierarchical order
            sort=['project.name', 'file.path'],
            sort_direction=[SortDirection.ASC.value] * 2,
        )

        # Ignoring type annotation to appease mypy, since nested dicts are tricky to type
        ***ARANGO_USERNAME*** = {}  # type: ignore
        chain: List[int] = []
        file_map = {}
        for file in hierarchy:
            if file and file.calculated_privileges[g.current_user.id].readable:
                file_map[file.id] = file

                # Files with a depth of 1 are ***ARANGO_USERNAME*** folders
                depth = file.path.count('/')

                # Add a link to the chain
                if depth > len(chain):
                    chain.append(file.id)
                # Cut off the chain up to the new depth
                elif depth < len(chain):
                    chain = chain[: (len(chain) - (len(chain) - depth)) - 1]
                    chain.append(file.id)
                # Replace the last link in the chain
                else:
                    if len(chain):
                        chain[-1] = file.id
                    else:
                        chain.append(file.id)

                curr_dir = ***ARANGO_USERNAME***
                for link in chain:
                    if curr_dir.get(link, None) is None:
                        curr_dir[link] = {}
                    curr_dir = curr_dir[link]

        def generate_node_tree(id, children):
            file = file_map[id]
            return {
                'data': file,
                'level': file.path.count('/') - 1,
                'children': [
                    generate_node_tree(child_id, children[child_id])
                    for child_id in children
                ],
            }

        results = [generate_node_tree(file_id, ***ARANGO_USERNAME***[file_id]) for file_id in ***ARANGO_USERNAME***]

        current_app.logger.info(
            f'Generated file hierarchy!',
            extra=UserEventLog(
                username=g.current_user.username,
                event_type=LogEventType.FILESYSTEM.value,
            ).to_dict(),
        )
        return jsonify(
            FileHierarchyResponseSchema(
                context={
                    'user_privilege_filter': g.current_user.id,
                }
            ).dump(
                {
                    'results': results,
                }
            )
        )


class FileListView(FilesystemBaseView):
    @use_args(
        FileCreateRequestSchema, locations=['json', 'form', 'files', 'mixed_form_json']
    )
    @wrap_exceptions(ServerException, title='File Upload Error')
    def post(self, params):
        """Endpoint to create a new file or to clone a file into a new one."""

        # ========================================
        # Resolve parent
        # ========================================

        try:
            parent = Filesystem.get_nondeleted_recycled_file(
                Files.hash_id == params['parent_hash_id']
            )
            Filesystem.check_file_permissions(
                [parent], g.current_user, ['writable'], permit_recycled=False
            )
        except RecordNotFound as e:
            # Rewrite the error to make more sense
            raise ValidationError(
                "The requested parent object could not be found.", "parent_hash_id"
            ) from e

        if parent.mime_type != DirectoryTypeProvider.MIME_TYPE:
            raise ValidationError(
                f"The specified parent ({params['parent_hash_id']}) is "
                f"not a folder. It is a file, and you cannot make files "
                f"become a child of another file.",
                "parent_hash_id",
            )

        # Parent has been resolved
        del params['parent_hash_id']

        file = Filesystem.create_file(parent=parent, **params)

        db.session.commit()

        # ========================================
        # Return new file
        # ========================================

        return Filesystem.get_file_response(file.hash_id, g.current_user)

    @use_args(
        lambda request: BulkFileRequestSchema(),
        locations=['json', 'form', 'files', 'mixed_form_json'],
    )
    @use_args(
        lambda request: BulkFileUpdateRequestSchema(partial=True),
        locations=['json', 'form', 'files', 'mixed_form_json'],
    )
    def patch(self, targets, params):
        """File update endpoint."""

        # do NOT write any code before those two lines - it will cause some unit tests to fail
        current_user = g.current_user

        # Collect everything that we need to query
        target_hash_ids = targets['hash_ids']
        parent_hash_id = params.get('parent_hash_id', None)
        linked_hash_ids = params.get('hashes_of_linked', [])
        query_hash_ids = target_hash_ids + linked_hash_ids
        require_hash_ids = []

        if parent_hash_id in target_hash_ids:
            raise ValidationError(
                f'An object cannot be set as the parent of itself.', 'parentHashId'
            )
        if parent_hash_id is not None:
            query_hash_ids.append(parent_hash_id)
            require_hash_ids.append(parent_hash_id)

        files = Filesystem.get_nondeleted_recycled_files(
            Files.hash_id.in_(query_hash_ids),
            require_hash_ids=require_hash_ids,
            lazy_load_content=True,
        )
        missing_hash_ids = get_missing_hash_ids(query_hash_ids, files)

        target_files = []
        linked_files = []
        parent_file = None
        for file in files:
            if file.hash_id in target_hash_ids:
                target_files.append(file)
            elif file.hash_id in linked_hash_ids:
                linked_files.append(file)
            elif file.hash_id == parent_hash_id:
                parent_file = file

        self.update_files(target_files, parent_file, params, current_user)

        map_target_files_id = list(
            map(
                lambda f: f.id,
                filter(lambda f: f.mime_type == FILE_MIME_TYPE_MAP, target_files),
            )
        )
        linked_files_id = list(map(lambda f: f.id, linked_files))

        try:
            if map_target_files_id:
                db.session.query(MapLinks).filter(
                    MapLinks.map_id.in_(map_target_files_id),
                    MapLinks.linked_id.notin_(linked_files_id),
                ).delete(synchronize_session=False)
            if linked_files_id:
                db.session.execute(
                    insert(MapLinks)
                    .values(
                        list(
                            map(
                                lambda t: dict(map_id=t[0], linked_id=t[1]),
                                itertools.product(map_target_files_id, linked_files_id),
                            )
                        )
                    )
                    .on_conflict_do_nothing(constraint='uq_map_id_linked_id')
                )
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            raise

        db.session.commit()

        return Filesystem.get_bulk_file_response(
            target_hash_ids, current_user, missing_hash_ids
        )

    # noinspection DuplicatedCode
    @use_args(lambda request: BulkFileRequestSchema())
    def delete(self, targets):
        """File delete endpoint."""

        current_user = g.current_user

        hash_ids = targets['hash_ids']

        files = Filesystem.get_nondeleted_recycled_files(Files.hash_id.in_(hash_ids))
        Filesystem.check_file_permissions(
            files, current_user, ['writable'], permit_recycled=True
        )

        # ========================================
        # Apply
        # ========================================

        for file in files:
            children = Filesystem.get_nondeleted_recycled_files(
                and_(
                    Files.parent_id == file.id,
                    Files.recycling_date.is_(None),
                )
            )

            # For now, we won't let people delete non-empty folders (although this code
            # is subject to a race condition) because the app doesn't handle deletion that well
            # yet and the children would just become orphan files that would still be
            # accessible but only by URL and with no easy way to delete them
            if len(children):
                raise ValidationError('Only empty folders can be deleted.', 'hash_ids')

            if file.calculated_project.***ARANGO_USERNAME***_id == file.id:
                raise ValidationError(
                    f"You cannot delete the ***ARANGO_USERNAME*** directory "
                    f"for a project (the folder for the project "
                    f"'{file.calculated_project.name}' was specified)."
                )

            if not file.recycled:
                file.recycling_date = datetime.now()
                file.recycler = current_user
                file.modifier = current_user

            file.delete()

        db.session.commit()

        # ========================================
        # Return changed files
        # ========================================

        return jsonify(
            MultipleFileResponseSchema().dump(
                dict(
                    mapping={},
                    missing=[],
                )
            )
        )


class FileSearchView(FilesystemBaseView):
    @use_args(FileSearchRequestSchema)
    @use_args(PaginatedRequestSchema)
    def post(self, params: dict, pagination: dict):
        current_user = g.current_user

        if params['type'] == 'public':
            # First we query for public files without getting parent directory
            # or project information
            query = (
                db.session.query(Files.id)
                .filter(
                    Files.recycling_date.is_(None),
                    Files.deletion_date.is_(None),
                    Files.public.is_(True),
                )
                .order_by(*params['sort'])
            )

            if 'mime_types' in params:
                query = query.filter(Files.mime_type.in_(params['mime_types']))

            result = query.paginate(pagination['page'], pagination['limit'])

            # Now we get the full file information for this slice of the results
            files = Filesystem.get_nondeleted_recycled_files(Files.id.in_(result.items))
            total = result.total

        elif params['type'] == 'linked':
            hash_id = params['linked_hash_id']
            file = Filesystem.get_nondeleted_recycled_file(
                Files.hash_id == hash_id, lazy_load_content=True
            )
            Filesystem.check_file_permissions(
                [file], current_user, ['readable'], permit_recycled=True
            )

            # TODO: Sort?
            query = db.session.query(MapLinks.map_id).filter(
                MapLinks.linked_id == file.id
            )

            result = query.paginate(pagination['page'], pagination['limit'])

            # Now we get the full file information for this slice of the results
            files = Filesystem.get_nondeleted_recycled_files(Files.id.in_(result.items))
            total = len(files)
        elif params['type'] == 'pinned':
            files = Filesystem.get_nondeleted_recycled_files(
                filter=(
                    and_(
                        Files.recycling_date.is_(None),
                        Files.deletion_date.is_(None),
                        Files.pinned.is_(True),
                    )
                ),
                sort=['file.modified_date'],
                sort_direction=[SortDirection.DESC.value],
            )
            files = [
                file
                for file in files
                if file.calculated_privileges[current_user.id].readable
            ]
            # Ensure directories appear at the top of the list
            files.sort(key=lambda f: not (f.mime_type == FILE_MIME_TYPE_DIRECTORY))
            total = len(files)
        else:
            raise NotImplementedError()

        return jsonify(
            FileListSchema(
                context={
                    'user_privilege_filter': g.current_user.id,
                },
                exclude=('results.children',),
            ).dump(
                {
                    'total': total,
                    'results': files,
                }
            )
        )


class FileDetailView(FilesystemBaseView):
    def get(self, hash_id: str):
        """Fetch a single file."""
        current_user = g.current_user
        return Filesystem.get_file_response(hash_id, current_user)

    @use_args(
        lambda request: FileUpdateRequestSchema(partial=True),
        locations=['json', 'form', 'files', 'mixed_form_json'],
    )
    def patch(self, params: dict, hash_id: str):
        """Update a single file."""
        current_user = g.current_user

        # Collect everything that we need to query
        parent_hash_id = params.get('parent_hash_id', None)
        query_hash_ids = [hash_id]
        require_hash_ids = []

        if hash_id == parent_hash_id:
            raise ValidationError(
                f'An object cannot be set as the parent of itself.', 'parentHashId'
            )

        if parent_hash_id is not None:
            query_hash_ids.append(parent_hash_id)
            require_hash_ids.append(parent_hash_id)

        files = Filesystem.get_nondeleted_recycled_files(
            Files.hash_id.in_(query_hash_ids),
            require_hash_ids=require_hash_ids,
            lazy_load_content=True,
        )
        target_files = []
        parent_file = None
        for file in files:
            if file.hash_id in hash_id:
                target_files.append(file)
            elif file.hash_id == parent_hash_id:
                parent_file = file

        self.update_files(target_files, parent_file, params, current_user)
        db.session.commit()
        return self.get(hash_id)


class FileContentView(FilesystemBaseView):
    def get(self, hash_id: str):
        """Fetch a single file's content."""
        current_user = g.current_user

        file = Filesystem.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        Filesystem.check_file_permissions(
            [file], current_user, ['readable'], permit_recycled=True
        )

        # Lazy loaded
        if file.content:
            content = file.content.raw_file
            etag = file.content.checksum_sha256.hex()
        else:
            content = b''
            etag = hashlib.sha256(content).digest()

        return make_cacheable_file_response(
            request,
            content,
            etag=etag,
            filename=file.filename,
            mime_type=file.mime_type,
        )


class MapContentView(FilesystemBaseView):
    def get(self, hash_id: str):
        """Fetch a content (graph.json) from a map."""
        current_user = g.current_user

        file = Filesystem.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        Filesystem.check_file_permissions(
            [file], current_user, ['readable'], permit_recycled=True
        )

        if file.mime_type != FILE_MIME_TYPE_MAP:
            raise ValidationError(
                f'Cannot retrieve map content from file with mime type: '
                f'{file.mime_type}'
            )

        try:
            with FileContentBuffer(file.content.raw_file) as bufferView:
                zip_file = zipfile.ZipFile(bufferView)
                json_graph = zip_file.read('graph.json')
        except (KeyError, zipfile.BadZipFile):
            raise ValidationError(
                'Cannot retrieve contents of the file - it might be corrupted'
            )
        etag = hashlib.sha256(json_graph).hexdigest()

        return make_cacheable_file_response(
            request,
            json_graph,
            etag=etag,
            filename=file.filename,
            mime_type=file.mime_type,
        )


class FileExportView(FilesystemBaseView):
    # Move that to constants if accepted

    @use_args(FileExportRequestSchema)
    def post(self, params: dict, hash_id: str):
        """Export a file."""
        current_user = g.current_user

        file = Filesystem.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        Filesystem.check_file_permissions(
            [file], current_user, ['readable'], permit_recycled=True
        )

        file_type_service = get_file_type_service()
        file_type = file_type_service.get(file.mime_type)

        if params['export_linked']:
            export = file_type.generate_linked_export(file, params['format'])
        else:
            try:
                export = file_type.generate_export(file, params['format'])
            except ExportFormatError as e:
                raise ValidationError(
                    "Unknown or invalid export format for the requested file.",
                    params["format"],
                ) from e

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


class FileValidateView(FilesystemBaseView):
    def get(self, hash_id: str):
        """Validate a file."""
        current_user = g.current_user

        file = Filesystem.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        Filesystem.check_file_permissions(
            [file], current_user, ['readable'], permit_recycled=True
        )

        file_type_service: FileTypeService = get_file_type_service()
        file_type = file_type_service.get(file.mime_type)

        file_type.validate_content(FileContentBuffer(file.content.raw_file))

        return WarningSchema().dump({})


class FileBackupView(FilesystemBaseView):
    """Endpoint to manage 'backups' that are recorded for the user when they are editing a file
    so that they don't lose their work."""

    @use_args(
        FileBackupCreateRequestSchema,
        locations=['json', 'form', 'files', 'mixed_form_json'],
    )
    def put(self, params: dict, hash_id: str):
        """Endpoint to create a backup for a file for a user."""
        current_user = g.current_user

        file = Filesystem.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        Filesystem.check_file_permissions(
            [file], current_user, ['writable'], permit_recycled=False
        )

        backup = FileBackup()
        backup.file = file

        # TODO: Make this into a function? @staticmethod of MapTypeProvider
        # or should I get the instance here?
        # Alternatively, we can zip those on the client side - but the JZip was working really slow
        if params['content_value'].content_type == FILE_MIME_TYPE_MAP:
            new_content = FileContentBuffer()
            with new_content as bufferView:
                zip_content = zipfile.ZipFile(
                    bufferView, 'w', zipfile.ZIP_DEFLATED, strict_timestamps=False
                )
                # NOTE: The trick here is that when we unpack zip on the client-side, we are not
                # resetting the image manager memory - we are only appending new stuff to it.
                # This is why we do not need to store all images within the backup -
                # - just the unsaved ones.
                zip_content.writestr(
                    zipfile.ZipInfo('graph.json'), params['content_value'].read()
                )
                new_images = params.get('new_images') or []
                for image in new_images:
                    zip_content.writestr(
                        zipfile.ZipInfo('images/' + image.filename + '.png'),
                        image.read(),
                    )
                zip_content.close()
            with new_content as bufferView:
                backup.raw_value = bufferView.read()
        else:
            backup.raw_value = params['content_value'].read()
        backup.user = current_user
        db.session.add(backup)
        db.session.commit()

        return jsonify({})

    def delete(self, hash_id: str):
        """Get the backup stored for a file for a user."""
        current_user = g.current_user

        file = Filesystem.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        # They should only have a backup if the file was writable to them, so we're
        # only going to let users retrieve their backup if they can still write to the file
        Filesystem.check_file_permissions(
            [file], current_user, ['writable'], permit_recycled=False
        )

        file_backup_table = FileBackup.__table__
        db.session.execute(
            file_backup_table.delete().where(
                and_(
                    file_backup_table.c.file_id == file.id,
                    file_backup_table.c.user_id == current_user.id,
                )
            )
        )
        db.session.commit()

        return jsonify({})


class FileBackupContentView(FilesystemBaseView):
    """Endpoint to get the backup's content."""

    def get(self, hash_id):
        """Get the backup stored for a file for a user."""
        current_user = g.current_user

        file = Filesystem.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, lazy_load_content=True
        )
        # They should only have a backup if the file was writable to them, so we're
        # only going to let users retrieve their backup if they can still write to the file
        Filesystem.check_file_permissions(
            [file], current_user, ['writable'], permit_recycled=False
        )

        backup = (
            db.session.query(FileBackup)
            .options(raiseload('*'))
            .filter(
                FileBackup.file_id == file.id, FileBackup.user_id == current_user.id
            )
            .order_by(desc_(FileBackup.creation_date))
            .first()
        )

        if backup is None:
            raise RecordNotFound(
                title='Failed to Get File Backup',
                message='No backup stored for this file.',
            )

        content = backup.raw_value
        etag = hashlib.sha256(content).hexdigest()

        return make_cacheable_file_response(
            request,
            content,
            etag=etag,
            filename=file.filename,
            mime_type=file.mime_type,
        )


class FileVersionListView(FilesystemBaseView):
    """Endpoint to fetch the versions of a file."""

    @use_args(PaginatedRequestSchema)
    def get(self, pagination: dict, hash_id: str):
        current_user = g.current_user

        file = Filesystem.get_nondeleted_recycled_file(Files.hash_id == hash_id)
        Filesystem.check_file_permissions(
            [file], current_user, ['readable'], permit_recycled=False
        )

        query = (
            db.session.query(FileVersion)
            .options(raiseload('*'), joinedload(FileVersion.user))
            .filter(FileVersion.file_id == file.id)
            .order_by(desc_(FileVersion.creation_date))
        )

        result = query.paginate(pagination['page'], pagination['limit'])

        return jsonify(
            FileVersionHistorySchema(
                context={
                    'user_privilege_filter': g.current_user.id,
                }
            ).dump(
                {
                    'object': file,
                    'total': result.total,
                    'results': result.items,
                }
            )
        )


class FileVersionContentView(FilesystemBaseView):
    """Endpoint to fetch a file version."""

    @use_args(PaginatedRequestSchema)
    def get(self, pagination: dict, hash_id: str):
        current_user = g.current_user

        file_version = (
            db.session.query(FileVersion)
            .options(
                raiseload('*'),
                joinedload(FileVersion.user),
                joinedload(FileVersion.content),
            )
            .filter(FileVersion.hash_id == hash_id)
            .one()
        )

        file = Filesystem.get_nondeleted_recycled_file(Files.id == file_version.file_id)
        Filesystem.check_file_permissions(
            [file], current_user, ['readable'], permit_recycled=False
        )

        return file_version.content.raw_file


class FileLockBaseView(FilesystemBaseView):
    cutoff_duration = timedelta(minutes=5)

    def get_locks_response(self, hash_id: str):
        current_user = g.current_user

        file = Filesystem.get_nondeleted_recycled_file(Files.hash_id == hash_id)
        Filesystem.check_file_permissions(
            [file], current_user, ['writable'], permit_recycled=True
        )

        t_lock_user = aliased(AppUser)

        cutoff_date = datetime.now() - self.cutoff_duration

        query = (
            db.session.query(FileLock)
            .join(t_lock_user, t_lock_user.id == FileLock.user_id)
            .options(contains_eager(FileLock.user, alias=t_lock_user))
            .filter(
                FileLock.hash_id == file.hash_id, FileLock.acquire_date >= cutoff_date
            )
            .order_by(desc_(FileLock.acquire_date))
        )

        results = query.all()

        return jsonify(
            FileLockListResponse(
                context={
                    'current_user': current_user,
                }
            ).dump(
                {
                    'results': results,
                }
            )
        )


class FileLockListView(FileLockBaseView):
    """Endpoint to get the locks for a file."""

    def get(self, hash_id: str):
        return self.get_locks_response(hash_id)

    @use_args(FileLockCreateRequest)
    def put(self, params: Dict, hash_id: str):
        current_user = g.current_user

        file = Filesystem.get_nondeleted_recycled_file(Files.hash_id == hash_id)
        Filesystem.check_file_permissions(
            [file], current_user, ['writable'], permit_recycled=True
        )

        acquire_date = datetime.now()
        cutoff_date = datetime.now() - self.cutoff_duration

        file_lock_table = FileLock.__table__
        stmt = (
            insert(file_lock_table)
            .returning(
                file_lock_table.c.user_id,
            )
            .values(
                hash_id=file.hash_id, user_id=current_user.id, acquire_date=acquire_date
            )
            .on_conflict_do_update(
                index_elements=[
                    file_lock_table.c.hash_id,
                ],
                set_={
                    'acquire_date': datetime.now(),
                    'user_id': current_user.id,
                },
                where=and_(
                    file_lock_table.c.hash_id == hash_id,
                    or_(
                        file_lock_table.c.user_id == current_user.id,
                        file_lock_table.c.acquire_date < cutoff_date,
                    ),
                ),
            )
        )

        result = db.session.execute(stmt)
        lock_acquired = bool(len(list(result)))
        db.session.commit()

        if lock_acquired:
            return self.get_locks_response(hash_id)
        else:
            return make_response(self.get_locks_response(hash_id), 409)

    @use_args(FileLockDeleteRequest)
    def delete(self, params: Dict, hash_id: str):
        current_user = g.current_user

        file = Filesystem.get_nondeleted_recycled_file(Files.hash_id == hash_id)
        Filesystem.check_file_permissions(
            [file], current_user, ['writable'], permit_recycled=True
        )

        file_lock_table = FileLock.__table__
        db.session.execute(
            file_lock_table.delete().where(
                and_(
                    file_lock_table.c.hash_id == file.hash_id,
                    file_lock_table.c.user_id == current_user.id,
                )
            )
        )
        db.session.commit()

        return self.get_locks_response(hash_id)


class FileAnnotationHistoryView(FilesystemBaseView):
    """Implements lookup of a file's annotation history."""

    @use_args(PaginatedRequestSchema)
    def get(self, pagination: Dict, hash_id: str):
        """Get the annotation of a file."""
        user = g.current_user

        file = Filesystem.get_nondeleted_recycled_file(Files.hash_id == hash_id)
        Filesystem.check_file_permissions(
            [file], user, ['readable'], permit_recycled=True
        )

        query = (
            db.session.query(FileAnnotationsVersion)
            .filter(FileAnnotationsVersion.file == file)
            .order_by(desc_(FileAnnotationsVersion.creation_date))
            .options(joinedload(FileAnnotationsVersion.user))
        )

        per_page = pagination['limit']
        page = pagination['page']

        total = query.order_by(None).count()
        if page == 1:
            items = itertools.chain(
                [file], query.limit(per_page).offset((page - 1) * per_page)
            )
        else:
            items = query.limit(per_page + 1).offset((page - 1) * per_page - 1)

        results = []

        for newer, older in window(items):
            results.append(
                {
                    'date': older.creation_date,
                    'user': newer.user,
                    'cause': older.cause,
                    'inclusion_changes': self._get_annotation_changes(
                        older.custom_annotations, newer.custom_annotations, 'inclusion'
                    ),
                    'exclusion_changes': self._get_annotation_changes(
                        older.excluded_annotations,
                        newer.excluded_annotations,
                        'exclusion',
                    ),
                }
            )

        return jsonify(
            FileAnnotationHistoryResponseSchema().dump(
                {
                    'total': total,
                    'results': results,
                }
            )
        )

    def _get_annotation_changes(
        self,
        older: List[Union[FileAnnotationsVersion, Files]],
        newer: List[Union[FileAnnotationsVersion, Files]],
        type: Union[Literal['inclusion'], Literal['exclusion']],
    ) -> Iterable[Dict]:
        changes: Dict[str, Dict] = {}

        if older is None and newer is not None:
            for annotation in newer:
                self._add_change(changes, 'added', annotation, type)
        elif older is not None and newer is None:
            for annotation in older:
                self._add_change(changes, 'removed', annotation, type)
        elif older is not None and newer is not None:
            ddiff = DeepDiff(older, newer, ignore_order=True)
            for action in ('added', 'removed'):
                for key, annotation in ddiff.get(f'iterable_item_{action}', {}).items():
                    if key.startswith(
                        '***ARANGO_USERNAME***['
                    ):  # Only care about ***ARANGO_USERNAME*** changes right now
                        self._add_change(changes, action, annotation, type)

        return changes.values()

    def _add_change(
        self,
        changes: Dict[str, Dict],
        action: str,
        annotation: Dict,
        type: Union[Literal['inclusion'], Literal['exclusion']],
    ) -> None:
        meta = annotation['meta'] if type == 'inclusion' else annotation
        id = meta['id'] if len(meta['id']) else f"@@{meta['allText']}"

        if id not in changes:
            changes[id] = {
                'action': action,
                'meta': meta,
                'instances': [],
            }

        changes[id]['instances'].append(annotation)


class StarredFileListView(FilesystemBaseView):
    def get(self):
        user = g.current_user
        starred_file_ids = (
            db.session.query(StarredFile.file_id)
            .filter(StarredFile.user_id == user.id)
            .all()
        )

        starred_files = Filesystem.get_nondeleted_recycled_files(
            filter=Files.id.in_([file_id for file_id, in starred_file_ids])
        )

        # TODO: Need to update get_nondeleted_recycled_files so that we can sort on these
        # calculated properties. For instance, we also cannnot sort/filter by project name.
        starred_files.sort(
            key=lambda f: f.calculated_starred['creation_date'], reverse=True
        )
        total = len(starred_files)

        return jsonify(
            FileListSchema(
                context={
                    'user_privilege_filter': g.current_user.id,
                },
                exclude=('results.children',),
            ).dump(
                {
                    'total': total,
                    'results': starred_files,
                }
            )
        )


class FileStarUpdateView(FilesystemBaseView):
    @use_args(lambda request: FileStarUpdateRequest(partial=True))
    @wrap_exceptions(ServerException, title='Failed to Update File')
    def patch(self, params: dict, hash_id: str):
        user = g.current_user
        starred = params['starred']

        try:
            result = Filesystem.get_nondeleted_recycled_file(Files.hash_id == hash_id)
        except NoResultFound as e:
            raise RecordNotFound(
                message=f'Could not identify file with hash id {hash_id}',
            ) from e

        # If the user doesn't have permission to read the file they want to star, we throw
        Filesystem.check_file_permissions(
            [result], user, ['readable'], permit_recycled=False
        )

        if starred:
            # Don't need to update if the file is already starred by this user
            if result.calculated_starred is None:
                starred_file = StarredFile(user_id=user.id, file_id=result.id)
                db.session.add(starred_file)
                result.calculated_starred = starred_file
        # Delete the row only if it exists
        elif result.calculated_starred is not None:
            db.session.query(StarredFile).filter(
                StarredFile.id == result.calculated_starred['id']
            ).delete()
            result.calculated_starred = None

        db.session.commit()

        return jsonify(
            FileResponseSchema(
                context={
                    'user_privilege_filter': user.id,
                },
                exclude=(
                    'result.parent',
                    'result.children',  # We aren't loading sub-children
                ),
            ).dump(
                {
                    'result': result,
                }
            )
        )


# Use /content for endpoints that return binary data
bp.add_url_rule('objects', view_func=FileListView.as_view('file_list'))
bp.add_url_rule(
    'objects/hierarchy', view_func=FileHierarchyView.as_view('file_hierarchy')
)
bp.add_url_rule('search', view_func=FileSearchView.as_view('file_search'))
bp.add_url_rule('objects/<string:hash_id>', view_func=FileDetailView.as_view('file'))
bp.add_url_rule(
    'objects/<string:hash_id>/content',
    view_func=FileContentView.as_view('file_content'),
)
bp.add_url_rule(
    'objects/<string:hash_id>/map-content',
    view_func=MapContentView.as_view('map_content'),
)
bp.add_url_rule(
    'objects/<string:hash_id>/export', view_func=FileExportView.as_view('file_export')
)
bp.add_url_rule(
    'objects/<string:hash_id>/validate',
    view_func=FileValidateView.as_view('file_validate'),
)
bp.add_url_rule(
    'objects/<string:hash_id>/backup', view_func=FileBackupView.as_view('file_backup')
)
bp.add_url_rule(
    'objects/<string:hash_id>/backup/content',
    view_func=FileBackupContentView.as_view('file_backup_content'),
)
bp.add_url_rule(
    'objects/<string:hash_id>/versions',
    view_func=FileVersionListView.as_view('file_version_list'),
)
bp.add_url_rule(
    'versions/<string:hash_id>/content',
    view_func=FileVersionContentView.as_view('file_version_content'),
)
bp.add_url_rule(
    '/objects/<string:hash_id>/locks',
    view_func=FileLockListView.as_view('file_lock_list'),
)
bp.add_url_rule(
    '/objects/<string:hash_id>/annotation-history',
    view_func=FileAnnotationHistoryView.as_view('file_annotation_history'),
)
bp.add_url_rule(
    '/objects/starred', view_func=StarredFileListView.as_view('file_star_list')
)
bp.add_url_rule(
    '/objects/<string:hash_id>/star',
    view_func=FileStarUpdateView.as_view('file_star_update'),
)
