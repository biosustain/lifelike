import hashlib
import io
import itertools
import json
import os
import typing
from urllib.error import HTTPError
import zipfile

from collections import defaultdict
from datetime import datetime, timedelta
from deepdiff import DeepDiff
from flask import Blueprint, current_app, g, jsonify, make_response, request
from flask.views import MethodView
from marshmallow import ValidationError
from sqlalchemy import and_, asc as asc_, desc as desc_, or_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import raiseload, joinedload, lazyload, aliased, contains_eager
from sqlalchemy.orm.exc import NoResultFound
from sqlalchemy.sql.expression import text
from typing import Optional, List, Dict, Iterable, Union, Literal, Tuple
from webargs.flaskparser import use_args

from neo4japp.constants import (
    FILE_MIME_TYPE_DIRECTORY,
    FILE_MIME_TYPE_MAP,
    FILE_MIME_TYPE_PDF,
    MAX_FILE_SIZE,
    URL_FETCH_TIMEOUT,
    LogEventType,
    MAPS_RE,
    SUPPORTED_MAP_MERGING_FORMATS,
    UPDATE_DATE_MODIFIED_COLUMNS,
    SortDirection,
    LIFELIKE_DOMAIN,
)
from neo4japp.database import db, get_file_type_service, get_authorization_service
from neo4japp.exceptions import (
    AccessRequestRequiredError,
    FileUploadError,
    InvalidArgument,
    RecordNotFound,
    NotAuthorized,
    UnsupportedMediaTypeError
)
from neo4japp.models import (
    Projects,
    Files,
    FileContent,
    AppUser,
    FileVersion,
    FileBackup
)
from neo4japp.models.files import FileLock, FileAnnotationsVersion, MapLinks, StarredFile
from neo4japp.models.files_queries import (
    add_file_starred_columns,
    add_file_user_role_columns,
    build_file_hierarchy_query,
    FileHierarchy,
)
from neo4japp.models.projects_queries import add_project_user_role_columns
from neo4japp.schemas.annotations import FileAnnotationHistoryResponseSchema
from neo4japp.schemas.common import PaginatedRequestSchema
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
    MultipleFileResponseSchema
)
from neo4japp.services.file_types.exports import ExportFormatError
from neo4japp.services.file_types.providers import DirectoryTypeProvider
from neo4japp.utils.collections import window, find_index
from neo4japp.utils.http import make_cacheable_file_response
from neo4japp.utils.network import ContentTooLongError, read_url
from neo4japp.utils.logger import UserEventLog
from neo4japp.services.file_types.providers import BiocTypeProvider

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
        raise NotAuthorized(message='You do not have sufficient privileges.', code=400)

    query = db.session.query(Files.hash_id).filter(
        Files.mime_type == 'vnd.***ARANGO_DB_NAME***.document/enrichment-table')
    results = [hash_id[0] for hash_id in query.all()]
    return jsonify(dict(result=results)), 200


class FilesystemBaseView(MethodView):
    """
    Base view for filesystem endpoints with reusable methods for getting files
    from hash IDs, checking permissions, and validating input.
    """

    file_max_size = MAX_FILE_SIZE
    url_fetch_timeout = URL_FETCH_TIMEOUT
    url_fetch_user_agent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' \
                           '(KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36 Lifelike'

    def get_nondeleted_recycled_file(
        self,
        filter,
        lazy_load_content=False,
        attr_excl: List[str] = None
    ) -> Files:
        """
        Returns a file that is guaranteed to be non-deleted, but may or may not be
        recycled, that matches the provided filter. If you do not want recycled files,
        exclude them with a filter condition.

        :param filter: the SQL Alchemy filter
        :param lazy_load_content: whether to load the file's content into memory
        :param attr_excl: list of file attributes to exclude from the query
        :return: a non-null file
        """
        files = self.get_nondeleted_recycled_files(filter, lazy_load_content, attr_excl=attr_excl)
        if not len(files):
            raise RecordNotFound(
                title='File Not Found',
                message='The requested file object could not be found.',
                code=404)
        return files[0]

    def get_nondeleted_recycled_files(
            self,
            filter=None,
            lazy_load_content=False,
            require_hash_ids: List[str] = None,
            sort: List[str] = [],
            sort_direction: List[str] = [],
            attr_excl: List[str] = None
    ) -> List[Files]:
        """
        Returns files that are guaranteed to be non-deleted, but may or may not be
        recycled, that matches the provided filter. If you do not want recycled files,
        exclude them with a filter condition.

        :param filter: the SQL Alchemy filter
        :param lazy_load_content: whether to load the file's content into memory
        :param require_hash_ids: a list of file hash IDs that must be in the result
        :param attr_excl: list of file attributes to exclude from the query
        :param sort: str list of file attributes to order by
        :return: the result, which may be an empty list
        """
        current_user = g.current_user

        t_file = db.aliased(Files, name='_file')  # alias required for the FileHierarchy class
        t_project = db.aliased(Projects, name='_project')

        # The following code gets a whole file hierarchy, complete with permission
        # information for the current user for the whole hierarchy, all in one go, but the
        # code is unfortunately very complex. However, as long as we can limit the instances of
        # this complex code to only one place in the codebase (right here), while returning
        # just a list of file objects (therefore abstracting all complexity to within
        # this one method), hopefully we manage it. One huge upside is that anything downstream
        # from this method, including the client, has zero complexity to deal with because
        # all the required information is available.

        # First, we fetch the requested files, AND the parent folders of these files, AND the
        # project. Note that to figure out the project, as of writing, you have to walk
        # up the hierarchy to the top most folder to figure out the associated project, which
        # the following generated query does. In the future, we MAY want to cache the project of
        # a file on every file row to make a lot of queries a lot simpler.

        filters = [Files.deletion_date.is_(None)]
        if filter is not None:
            filters.append(filter)

        if len(sort) != len(sort_direction):
            raise ValueError(
                'Arguments `sort` and `sort_direction` should have an equal number' +
                'of elements.'
            )
        sort_direction_fns = map(
            lambda dirxn: (desc_ if dirxn == SortDirection.DESC.value else asc_),
            sort_direction
        )
        sort_map = zip(sort, sort_direction_fns)

        query = build_file_hierarchy_query(
            and_(*filters),
            t_project,
            t_file,
            file_attr_excl=attr_excl
        ).options(
            raiseload('*'), joinedload(t_file.user)
        ).order_by(
            *[dir_fn(text(f'_file.{col}')) for col, dir_fn in sort_map]
        )

        # Add extra boolean columns to the result indicating various permissions (read, write,
        # etc.) for the current user, which then can be read later by FileHierarchy or manually.
        # Note that file permissions are hierarchical (they are based on their parent folder and
        # also the project permissions), so you cannot just check these columns for ONE file to
        # determine a permission -- you also have to read all parent folders and the project!
        # Thankfully, we just loaded all parent folders and the project above, and so we'll use
        # the handy FileHierarchy class later to calculate this permission information.
        private_data_access = get_authorization_service().has_role(
            current_user, 'private-data-access'
        )
        query = add_project_user_role_columns(query, t_project, current_user.id,
                                              access_override=private_data_access)
        query = add_file_user_role_columns(query, t_file, current_user.id,
                                           access_override=private_data_access)
        query = add_file_starred_columns(query, t_file, current_user.id)

        if lazy_load_content:
            query = query.options(lazyload(t_file.content))

        results = query.all()

        # Because this method supports loading multiple files AND their hierarchy EACH, the query
        # dumped out every file AND every file's hierarchy. To figure out permissions for a file,
        # we need to figure out which rows belong to which file, which we can do because the query
        # put the initial file ID in the initial_id column
        grouped_results = defaultdict(lambda: [])
        for row in results:
            grouped_results[row._asdict()['initial_id']].append(row)

        # Now we use FileHierarchy to calculate permissions, AND the project (because remember,
        # projects are only linked to the ***ARANGO_USERNAME*** folder, and so you cannot just do Files.project).
        # We also calculate whether a file is recycled for cases when a file itself is not recycled,
        # but one of its parent folders is (NOTE: maybe in the future,
        # 'recycled' should not be inherited?)
        files = []
        for rows in grouped_results.values():
            hierarchy = FileHierarchy(rows, t_file, t_project)
            hierarchy.calculate_properties([current_user.id])
            hierarchy.calculate_privileges([current_user.id])
            hierarchy.calculate_starred_files()
            files.append(hierarchy.file)

        # Handle helper require_hash_ids argument that check to see if all files wanted
        # actually appeared in the results
        if require_hash_ids:
            missing_hash_ids = self.get_missing_hash_ids(require_hash_ids, files)

            if len(missing_hash_ids):
                raise RecordNotFound(
                    title='File Not Found',
                    message=f"The request specified one or more file or directory "
                            f"({', '.join(missing_hash_ids)}) that could not be found.",
                    code=404)

        # In the end, we just return a list of Files instances!
        return files

    def get_nondeleted_recycled_descendants(
        self,
        filter,
        lazy_load_content=False,
        require_hash_ids: List[str] = None,
        sort: List[str] = [],
        attr_excl: List[str] = None
    ) -> List[Files]:
        """
        Returns files that are guaranteed to be non-deleted, but may or may not be
        recycled, that matches the provided filter. If you do not want recycled files,
        exclude them with a filter condition.

        :param filter: the SQL Alchemy filter
        :param lazy_load_content: whether to load the file's content into memory
        :param require_hash_ids: a list of file hash IDs that must be in the result
        :param attr_excl: list of file attributes to exclude from the query
        :param sort: str list of file attributes to order by
        :return: the result, which may be an empty list
        """
        current_user = g.current_user

        t_file = db.aliased(Files, name='_file')  # alias required for the FileHierarchy class
        t_project = db.aliased(Projects, name='_project')

        # The following code gets a whole file hierarchy, complete with permission
        # information for the current user for the whole hierarchy, all in one go, but the
        # code is unfortunately very complex. However, as long as we can limit the instances of
        # this complex code to only one place in the codebase (right here), while returning
        # just a list of file objects (therefore abstracting all complexity to within
        # this one method), hopefully we manage it. One huge upside is that anything downstream
        # from this method, including the client, has zero complexity to deal with because
        # all the required information is available.

        # First, we fetch the requested files, AND the parent folders of these files, AND the
        # project. Note that to figure out the project, as of writing, you have to walk
        # up the hierarchy to the top most folder to figure out the associated project, which
        # the following generated query does. In the future, we MAY want to cache the project of
        # a file on every file row to make a lot of queries a lot simpler.
        query = build_file_hierarchy_query(
            and_(
                filter,
                Files.deletion_date.is_(None)
            ),
            t_project,
            t_file,
            file_attr_excl=attr_excl,
            direction='children'
        ) \
            .options(raiseload('*'),
                     joinedload(t_file.user)) \
            .order_by(*[text(f'_file.{col}') for col in sort])

        # Add extra boolean columns to the result indicating various permissions (read, write,
        # etc.) for the current user, which then can be read later by FileHierarchy or manually.
        # Note that file permissions are hierarchical (they are based on their parent folder and
        # also the project permissions), so you cannot just check these columns for ONE file to
        # determine a permission -- you also have to read all parent folders and the project!
        # Thankfully, we just loaded all parent folders and the project above, and so we'll use
        # the handy FileHierarchy class later to calculate this permission information.
        private_data_access = get_authorization_service().has_role(
            current_user, 'private-data-access'
        )
        query = add_project_user_role_columns(query, t_project, current_user.id,
                                              access_override=private_data_access)
        query = add_file_user_role_columns(query, t_file, current_user.id,
                                           access_override=private_data_access)

        if lazy_load_content:
            query = query.options(lazyload(t_file.content))

        # In the end, we just return a list of Files instances!
        return [row[0] for row in query.all()]

    def check_file_permissions(
            self,
            files: List[Files],
            user: AppUser,
            require_permissions: List[str],
            *,
            permit_recycled: bool
    ):
        """
        Helper method to check permissions on the provided files and other properties
        that you may want to check for. On error, an exception is thrown.

        :param files: the files to check
        :param user: the user to check permissions for
        :param require_permissions: a list of permissions to require (like 'writable')
        :param permit_recycled: whether to allow recycled files
        """
        # Check each file
        for file in files:
            for permission in require_permissions:
                if not getattr(file.calculated_privileges[user.id], permission):
                    # Do not reveal the filename with the error!
                    # TODO: probably refactor these readable, commentable to
                    # actual string values...

                    if not file.calculated_privileges[user.id].readable:
                        raise AccessRequestRequiredError(
                            curr_access='no',
                            req_access='readable',
                            hash_id=file.hash_id
                        )
                    else:
                        if permission == 'commentable':
                            raise AccessRequestRequiredError(
                                curr_access='commentable',
                                req_access='writable',
                                hash_id=file.hash_id
                            )
                        else:
                            raise AccessRequestRequiredError(
                                curr_access='readable',
                                req_access='writable',
                                hash_id=file.hash_id
                            )

            if not permit_recycled and (file.recycled or file.parent_recycled):
                raise ValidationError(
                    f"The file or directory '{file.filename}' has been trashed and "
                    "must be restored first.")

    def update_files(
        self,
        target_files: List[Files],
        parent_file: Optional[Files],
        params: Dict,
        user: AppUser
    ):
        """
        Updates the specified files using the parameters from a validated request.
        :param target_files: the files to update
        :param parent_file: parent file of the files to update
        :param params: the parameters
        :param user: the user that is making the change
        """
        # ========================================
        # Check
        # ========================================
        files_to_check = target_files[:]  # Makes a copy of target_files so we don't mutate it
        if parent_file is not None:
            # Prevent recursive parent hash IDs
            if parent_file.hash_id in [file.hash_id for file in target_files]:
                raise ValidationError(
                    f'An object cannot be set as the parent of itself.',
                    'parentHashId'
                )

            # Check the specified parent to see if it can even be a parent
            if parent_file.mime_type != DirectoryTypeProvider.MIME_TYPE:
                raise ValidationError(
                    f'The specified parent ({parent_file.hash_id}) is '
                    f'not a folder. It is a file, and you cannot make files '
                    f'become a child of another file.', 'parentHashId'
                )
            files_to_check.append(parent_file)

        self.check_file_permissions(files_to_check, user, ['writable'], permit_recycled=False)

        if 'content_value' in params and len(target_files) > 1:
            # We don't allow multiple files to be changed due to a potential deadlock
            # in FileContent.get_or_create(), and also because it's a weird use case
            raise NotImplementedError(
                "Cannot update the content of multiple files with this method")

        # ========================================
        # Apply
        # ========================================
        file_type_service = get_file_type_service()
        update_modified_date = any([param in UPDATE_DATE_MODIFIED_COLUMNS for param in params])

        for file in target_files:
            assert file.calculated_project is not None
            is_***ARANGO_USERNAME***_dir = (file.calculated_project.***ARANGO_USERNAME***_id == file.id)

            if 'description' in params:
                if file.description != params['description']:
                    file.description = params['description']

            # Some changes cannot be applied to ***ARANGO_USERNAME*** directories
            if not is_***ARANGO_USERNAME***_dir:
                if parent_file is not None:
                    # Re-check referential parent
                    if file.id == parent_file.id:
                        raise ValidationError(f'A file or folder ({file.filename}) cannot be '
                                              f'set as the parent of itself.', "parentHashId")

                    # TODO: Check max hierarchy depth

                    # Check for circular inheritance
                    current_parent = parent_file.parent
                    while current_parent:
                        if current_parent.hash_id == file.hash_id:
                            raise ValidationError(
                                f"If the parent of '{file.filename}' was set to "
                                f"'{parent_file.filename}', it would result in circular"
                                f"inheritance.", "parent_hash_id")
                        current_parent = current_parent.parent

                    file.parent_id = parent_file.id

                if 'filename' in params:
                    file.filename = params['filename']

                if 'public' in params:
                    # Directories can't be public because it doesn't work right in all
                    # places yet (namely not all API endpoints that query for public files will
                    # pick up files within a public directory)
                    if file.mime_type != DirectoryTypeProvider.MIME_TYPE and \
                            file.public != params['public']:
                        file.public = params['public']

                if 'pinned' in params:
                    file.pinned = params['pinned']

                if 'fallback_organism' in params:
                    if params['fallback_organism'] is None:
                        file.organism_name = None
                        file.organism_synonym = None
                        file.organism_taxonomy_id = None
                    else:
                        try:
                            file.organism_name = params['fallback_organism']['organism_name']
                            file.organism_synonym = params['fallback_organism']['synonym']
                            file.organism_taxonomy_id = params['fallback_organism']['tax_id']
                        except KeyError:
                            raise InvalidArgument(
                                title='Failed to Update File',
                                message='You must provide the following properties for a ' +
                                        'fallback organism: "organism_name", "synonym", "tax_id".',
                            )

                if 'annotation_configs' in params:
                    file.annotation_configs = params['annotation_configs']

                if 'content_value' in params:
                    buffer = params['content_value']

                    # Get file size
                    buffer.seek(0, io.SEEK_END)
                    size = buffer.tell()
                    buffer.seek(0)

                    if size > self.file_max_size:
                        raise ValidationError(
                            'Your file could not be processed because it is too large.',
                            "content_value")

                    # Get the provider
                    provider = file_type_service.get(file)
                    buffer = provider.prepare_content(buffer, params, file)
                    try:
                        provider.validate_content(buffer)
                        buffer.seek(0)  # Must rewind
                    except ValueError:
                        raise ValidationError(f"The provided file may be corrupt for files of type "
                                              f"'{file.mime_type}' (which '{file.hash_id}' is of).",
                                              "contentValue")

                    new_content_id = FileContent.get_or_create(buffer)
                    buffer.seek(0)  # Must rewind

                    # Only make a file version if the content actually changed
                    if file.content_id != new_content_id:
                        # Create file version
                        version = FileVersion()
                        version.file = file
                        version.content_id = file.content_id
                        version.user = user
                        db.session.add(version)

                        file.content_id = new_content_id
                        provider.handle_content_update(file)
            file.modifier = user
            if update_modified_date:
                # TODO: Ideally, we would let the ORM handle this. However, our tests need to be
                # updated with proper transaction management first.
                file.modified_date = datetime.now()

        try:
            db.session.commit()
        except IntegrityError as e:
            db.session.rollback()
            raise ValidationError(
                "No two items (folder or file) can share the same name.",
                "filename"
            )

    def get_file_response(self, hash_id: str, user: AppUser):
        """
        Fetch a file and return a response that can be sent to the client. Permissions
        are checked and this method will throw a relevant response exception.

        :param hash_id: the hash ID of the file
        :param user: the user to check permissions for
        :return: the response
        """
        # TODO: Potentially move these annotations into a separate table
        EXCLUDE_FIELDS = ['enrichment_annotations', 'annotations']

        # TODO: Ideally, we would not query for the files again. But, because we have so much code
        # that depends on the Files objects not being expired, we have to.
        return_file = self.get_nondeleted_recycled_file(
            Files.hash_id == hash_id,
            attr_excl=EXCLUDE_FIELDS
        )
        self.check_file_permissions([return_file], user, ['readable'], permit_recycled=True)

        children = self.get_nondeleted_recycled_files(and_(
            Files.parent_id == return_file.id,
            Files.recycling_date.is_(None),
        ), attr_excl=EXCLUDE_FIELDS)
        # Note: We don't check permissions here, but there are no negate permissions
        return_file.calculated_children = children

        return jsonify(FileResponseSchema(context={
            'user_privilege_filter': g.current_user.id,
        }, exclude=(
            'result.children.children',  # We aren't loading sub-children
        )).dump({
            'result': return_file,
        }))

    def get_bulk_file_response(
            self,
            hash_ids,
            user: AppUser,
            missing_hash_ids: Iterable[str] = None
    ):
        """
        Fetch several files and return a response that can be sent to the client. Could
        possibly return a response with an empty list if there were no matches. Permissions
        are checked and this method will throw a relevant response exception.

        :param hash_ids: the hash IDs of the files
        :param user: the user to check permissions for
        :param missing_hash_ids: IDs to put in the response
        :return: the response
        """
        # TODO: Ideally, we would not query for the files again. But, because we have so much code
        # that depends on the Files objects not being expired, we have to.
        files = self.get_nondeleted_recycled_files(Files.hash_id.in_(hash_ids))
        self.check_file_permissions(files, user, ['readable'], permit_recycled=True)

        returned_files = {}

        for file in files:
            if file.calculated_privileges[user.id].readable:
                returned_files[file.hash_id] = file

        return jsonify(
            MultipleFileResponseSchema(
                context={
                    'user_privilege_filter': user.id,
                },
                exclude=(
                    'mapping.children',
                )
            ).dump(
                dict(
                    mapping=returned_files,
                    missing=list(missing_hash_ids) if missing_hash_ids is not None else [],
                )
            )
        )

    def get_missing_hash_ids(self, expected_hash_ids: Iterable[str], files: Iterable[Files]):
        found_hash_ids = set(file.hash_id for file in files)
        missing = set()
        for hash_id in expected_hash_ids:
            if hash_id not in found_hash_ids:
                missing.add(hash_id)
        return missing


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
                event_type=LogEventType.FILESYSTEM.value
            ).to_dict()
        )

        filters = [Files.recycling_date.is_(None)]

        if params['directories_only']:
            filters.append(Files.mime_type == DirectoryTypeProvider.MIME_TYPE)

        hierarchy = self.get_nondeleted_recycled_files(
            and_(*filters),
            sort=['path'],
            sort_direction=[SortDirection.ASC.value]
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
                    chain = chain[:(len(chain) - (len(chain) - depth)) - 1]
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
                ]
            }

        results = [generate_node_tree(file_id, ***ARANGO_USERNAME***[file_id]) for file_id in ***ARANGO_USERNAME***]

        current_app.logger.info(
            f'Generated file hierarchy!',
            extra=UserEventLog(
                username=g.current_user.username,
                event_type=LogEventType.FILESYSTEM.value
            ).to_dict()
        )
        return jsonify(FileHierarchyResponseSchema(context={
            'user_privilege_filter': g.current_user.id,
        }).dump({
            'results': results,
        }))


class FileListView(FilesystemBaseView):

    @use_args(FileCreateRequestSchema, locations=['json', 'form', 'files', 'mixed_form_json'])
    def post(self, params):
        """Endpoint to create a new file or to clone a file into a new one."""

        current_user = g.current_user
        file_type_service = get_file_type_service()

        file = Files()
        file.filename = params['filename']
        file.description = params.get('description')
        file.user = current_user
        file.creator = current_user
        file.modifier = current_user
        file.public = params.get('public', False)

        # ========================================
        # Resolve parent
        # ========================================

        try:
            parent = self.get_nondeleted_recycled_file(Files.hash_id == params['parent_hash_id'])
            self.check_file_permissions([parent], current_user, ['writable'], permit_recycled=False)
        except RecordNotFound:
            # Rewrite the error to make more sense
            raise ValidationError("The requested parent object could not be found.",
                                  "parent_hash_id")

        if parent.mime_type != DirectoryTypeProvider.MIME_TYPE:
            raise ValidationError(f"The specified parent ({params['parent_hash_id']}) is "
                                  f"not a folder. It is a file, and you cannot make files "
                                  f"become a child of another file.", "parent_hash_id")

        # TODO: Check max hierarchy depth

        file.parent = parent

        assert file.parent is not None

        # ========================================
        # Resolve file content
        # ========================================

        # Clone operation
        if params.get('content_hash_id') is not None:
            source_hash_id: Optional[str] = params.get("content_hash_id")

            try:
                existing_file = self.get_nondeleted_recycled_file(Files.hash_id == source_hash_id)
                self.check_file_permissions([existing_file], current_user, ['readable'],
                                            permit_recycled=True)
            except RecordNotFound:
                raise ValidationError(f"The requested file or directory to clone from "
                                      f"({source_hash_id}) could not be found.",
                                      "content_hash_id")

            if existing_file.mime_type == DirectoryTypeProvider.MIME_TYPE:
                raise ValidationError(f"The specified clone source ({source_hash_id}) "
                                      f"is a folder and that is not supported.", "mime_type")

            file.mime_type = existing_file.mime_type
            file.doi = existing_file.doi
            file.annotations = existing_file.annotations
            file.annotations_date = existing_file.annotations_date
            file.custom_annotations = existing_file.custom_annotations
            file.upload_url = existing_file.upload_url
            file.excluded_annotations = existing_file.excluded_annotations
            file.content_id = existing_file.content_id

            if 'description' not in params:
                file.description = existing_file.description

        # Create operation
        else:
            buffer, url = self._get_content_from_params(params)

            # Figure out file size
            buffer.seek(0, io.SEEK_END)
            size = buffer.tell()
            buffer.seek(0)

            # Check max file size
            if size > self.file_max_size:
                raise ValidationError(
                    'Your file could not be processed because it is too large.')

            # Save the URL
            file.upload_url = url

            mime_type = params.get('mime_type')

            # Detect mime type
            if mime_type:
                file.mime_type = mime_type
            else:
                mime_type = file_type_service.detect_mime_type(buffer)
                buffer.seek(0)  # Must rewind
                file.mime_type = mime_type

            # Get the provider based on what we know now
            provider = file_type_service.get(file)
            # if no provider matched try to convert

            # if it is a bioc-xml file
            if isinstance(provider, BiocTypeProvider):
                # then convert it to BiocJSON
                provider.convert(buffer)
                file_name, ext = os.path.splitext(file.filename)
                # if ext is not bioc then set it bioc.
                if ext.lower() != '.bioc':
                    file.filename = file_name + '.bioc'

            if provider == file_type_service.default_provider:
                file_name, extension = os.path.splitext(file.filename)
                if extension.isupper():
                    file.mime_type = 'application/pdf'
                provider = file_type_service.get(file)
                provider.convert(buffer)

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
                try:
                    buffer.close()
                except Exception:
                    pass

        # ========================================
        # Annotation options
        # ========================================

        if params.get('fallback_organism', None):
            file.organism_name = params['fallback_organism']['organism_name']
            file.organism_synonym = params['fallback_organism']['synonym']
            file.organism_taxonomy_id = params['fallback_organism']['tax_id']

        if params.get('annotation_configs'):
            file.annotation_configs = params['annotation_configs']

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
        # rollback in case of error?

        # ========================================
        # Return new file
        # ========================================

        return self.get_file_response(file.hash_id, current_user)

    @use_args(lambda request: BulkFileRequestSchema(),
              locations=['json', 'form', 'files', 'mixed_form_json'])
    @use_args(lambda request: BulkFileUpdateRequestSchema(partial=True),
              locations=['json', 'form', 'files', 'mixed_form_json'])
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
                f'An object cannot be set as the parent of itself.',
                'parentHashId'
            )
        if parent_hash_id is not None:
            query_hash_ids.append(parent_hash_id)
            require_hash_ids.append(parent_hash_id)

        files = self.get_nondeleted_recycled_files(
            Files.hash_id.in_(query_hash_ids),
            require_hash_ids=require_hash_ids,
            lazy_load_content=True
        )
        missing_hash_ids = self.get_missing_hash_ids(query_hash_ids, files)

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
                filter(
                    lambda f: f.mime_type == FILE_MIME_TYPE_MAP,
                    target_files
                )
            )
        )
        linked_files_id = list(map(lambda f: f.id, linked_files))
        try:
            if map_target_files_id:
                db.session.query(
                    MapLinks
                ).filter(
                    MapLinks.map_id.in_(map_target_files_id),
                    MapLinks.linked_id.notin_(linked_files_id)
                ).delete(synchronize_session=False)
            if linked_files_id:
                db.session.execute(
                    insert(MapLinks).values(
                        list(map(
                            lambda t: dict(map_id=t[0], linked_id=t[1]),
                            itertools.product(
                                map_target_files_id,
                                linked_files_id
                            )
                        ))
                    ).on_conflict_do_nothing(
                        constraint='uq_map_id_linked_id'
                    )
                )
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            raise

        return self.get_bulk_file_response(target_hash_ids, current_user, missing_hash_ids)

    # noinspection DuplicatedCode
    @use_args(lambda request: BulkFileRequestSchema())
    def delete(self, targets):
        """File delete endpoint."""

        current_user = g.current_user

        hash_ids = targets['hash_ids']

        files = self.get_nondeleted_recycled_files(Files.hash_id.in_(hash_ids))
        self.check_file_permissions(files, current_user, ['writable'], permit_recycled=True)

        # ========================================
        # Apply
        # ========================================

        for file in files:
            children = self.get_nondeleted_recycled_files(and_(
                Files.parent_id == file.id,
                Files.recycling_date.is_(None),
            ))

            # For now, we won't let people delete non-empty folders (although this code
            # is subject to a race condition) because the app doesn't handle deletion that well
            # yet and the children would just become orphan files that would still be
            # accessible but only by URL and with no easy way to delete them
            if len(children):
                raise ValidationError('Only empty folders can be deleted.', 'hash_ids')

            if file.calculated_project.***ARANGO_USERNAME***_id == file.id:
                raise ValidationError(f"You cannot delete the ***ARANGO_USERNAME*** directory "
                                      f"for a project (the folder for the project "
                                      f"'{file.calculated_project.name}' was specified).")

            if not file.recycled:
                file.recycling_date = datetime.now()
                file.recycler = current_user
                file.modifier = current_user

            file.delete()

        db.session.commit()
        # rollback in case of error?

        # ========================================
        # Return changed files
        # ========================================

        return jsonify(MultipleFileResponseSchema().dump(dict(
            mapping={},
            missing=[],
        )))

    def _get_content_from_params(self, params: dict) -> Tuple[io.BufferedIOBase, Optional[str]]:
        url = params.get('content_url')
        buffer = params.get('content_value')

        # Fetch from URL
        if url is not None:
            try:
                # Note that in the future, we may wish to upload files of many different types
                # from URL. Limiting ourselves to merely PDFs is a little short-sighted, but for
                # now it is the expectation.
                buffer = read_url(
                    url=url,
                    headers={
                        'User-Agent': self.url_fetch_user_agent,
                        'Accept': FILE_MIME_TYPE_PDF,
                    },
                    max_length=self.file_max_size,
                    prefer_direct_downloads=True,
                    timeout=self.url_fetch_timeout
                )
            except UnsupportedMediaTypeError as e:
                # The server did not respect our request for a PDF and did not throw a 406, so
                # instead we have thrown a 415 to prevent non-pdf documents from being uploaded.
                raise FileUploadError(
                    title='File Upload Error',
                    message='Your file could not be uploaded. Please make sure your URL ends ' +
                            'with .pdf. For example, https://www.example.com/file.pdf. If the ' +
                            'problem persists, please download the file to your computer from ' +
                            'the original website and upload the file from your device.',
                    code=e.code
                )
            except HTTPError as http_err:
                # Should be raised because of the 'Accept' content type header above.
                if http_err.code == 406:
                    raise FileUploadError(
                        title='File Upload Error',
                        message='Your file could not be uploaded. Please make sure your URL ends ' +
                                'with .pdf. For example, https://www.example.com/file.pdf. If ' +
                                'the problem persists, please download the file to your ' +
                                'computer from the original website and upload the file from ' +
                                'your device.',
                    )
                else:
                    # An error occurred that we were not expecting.
                    raise FileUploadError(
                        title='File Upload Error',
                        message='Your file could not be uploaded due to an unexpected error, ' +
                                'please try again. If the problem persists, please download the ' +
                                'file to your computer from the original website and upload the ' +
                                'file from your device.'
                    )
            except ContentTooLongError:
                raise FileUploadError(
                    title='File Upload Error',
                    message='Your file could not be uploaded. The requested file is too large. ' +
                            'Please limit file uploads to less than 315MB.',
                )

            return buffer, url

        # Fetch from upload
        elif buffer is not None:
            return buffer, None
        else:
            return typing.cast(io.BufferedIOBase, io.BytesIO()), None


class FileSearchView(FilesystemBaseView):

    @use_args(FileSearchRequestSchema)
    @use_args(PaginatedRequestSchema)
    def post(self, params: dict, pagination: dict):
        current_user = g.current_user

        if params['type'] == 'public':
            # First we query for public files without getting parent directory
            # or project information
            query = db.session.query(Files.id) \
                .filter(Files.recycling_date.is_(None),
                        Files.deletion_date.is_(None),
                        Files.public.is_(True)) \
                .order_by(*params['sort'])

            if 'mime_types' in params:
                query = query.filter(Files.mime_type.in_(params['mime_types']))

            result = query.paginate(pagination['page'], pagination['limit'])

            # Now we get the full file information for this slice of the results
            files = self.get_nondeleted_recycled_files(Files.id.in_(result.items))
            total = result.total

        elif params['type'] == 'linked':
            hash_id = params['linked_hash_id']
            file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id,
                                                     lazy_load_content=True)
            self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)

            # TODO: Sort?
            query = db.session.query(MapLinks.map_id) \
                .filter(MapLinks.linked_id == file.id)

            result = query.paginate(pagination['page'], pagination['limit'])

            # Now we get the full file information for this slice of the results
            files = self.get_nondeleted_recycled_files(Files.id.in_(result.items))
            total = len(files)
        elif params['type'] == 'pinned':
            files = self.get_nondeleted_recycled_files(
                filter=(
                    and_(
                        Files.recycling_date.is_(None),
                        Files.deletion_date.is_(None),
                        Files.pinned.is_(True)
                    )
                ),
                sort=['modified_date'],
                sort_direction=[SortDirection.DESC.value]
            )
            files = [
                file for file in files
                if file.calculated_privileges[current_user.id].readable
            ]
            # Ensure directories appear at the top of the list
            files.sort(key=lambda f: not (f.mime_type == FILE_MIME_TYPE_DIRECTORY))
            total = len(files)
        else:
            raise NotImplementedError()

        return jsonify(FileListSchema(context={
            'user_privilege_filter': g.current_user.id,
        }, exclude=(
            'results.children',
        )).dump({
            'total': total,
            'results': files,
        }))


class FileDetailView(FilesystemBaseView):

    def get(self, hash_id: str):
        """Fetch a single file."""
        current_user = g.current_user
        return self.get_file_response(hash_id, current_user)

    @use_args(lambda request: FileUpdateRequestSchema(partial=True),
              locations=['json', 'form', 'files', 'mixed_form_json'])
    def patch(self, params: dict, hash_id: str):
        """Update a single file."""
        current_user = g.current_user

        # Collect everything that we need to query
        parent_hash_id = params.get('parent_hash_id', None)
        query_hash_ids = [hash_id]
        require_hash_ids = []

        if hash_id == parent_hash_id:
            raise ValidationError(
                f'An object cannot be set as the parent of itself.',
                'parentHashId'
            )

        if parent_hash_id is not None:
            query_hash_ids.append(parent_hash_id)
            require_hash_ids.append(parent_hash_id)

        files = self.get_nondeleted_recycled_files(
            Files.hash_id.in_(query_hash_ids),
            require_hash_ids=require_hash_ids,
            lazy_load_content=True
        )
        target_files = []
        parent_file = None
        for file in files:
            if file.hash_id in hash_id:
                target_files.append(file)
            elif file.hash_id == parent_hash_id:
                parent_file = file

        self.update_files(target_files, parent_file, params, current_user)
        return self.get(hash_id)


class FileContentView(FilesystemBaseView):

    def get(self, hash_id: str):
        """Fetch a single file's content."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)

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
            mime_type=file.mime_type
        )


class MapContentView(FilesystemBaseView):

    def get(self, hash_id: str):
        """Fetch a content (graph.json) from a map."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)

        if file.mime_type != FILE_MIME_TYPE_MAP:
            raise ValidationError(f'Cannot retrieve map content from file with mime type: '
                                  f'{file.mime_type}')

        try:
            zip_file = zipfile.ZipFile(io.BytesIO(file.content.raw_file))
            json_graph = zip_file.read('graph.json')
        except (KeyError, zipfile.BadZipFile):
            raise ValidationError(
                'Cannot retrieve contents of the file - it might be corrupted')
        etag = hashlib.sha256(json_graph).hexdigest()

        return make_cacheable_file_response(
            request,
            json_graph,
            etag=etag,
            filename=file.filename,
            mime_type=file.mime_type
        )


class FileExportView(FilesystemBaseView):

    # Move that to constants if accepted

    @use_args(FileExportRequestSchema)
    def post(self, params: dict, hash_id: str):
        """Export a file."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)

        file_type_service = get_file_type_service()
        file_type = file_type_service.get(file)

        if params['export_linked'] and params['format'] in SUPPORTED_MAP_MERGING_FORMATS:
            link_to_page_map: Dict[str, int] = dict()
            files = self.get_all_linked_maps(file, {file.hash_id}, [file], link_to_page_map)
            export = file_type.merge(files, params['format'], link_to_page_map)
        else:
            try:
                export = file_type.generate_export(file, params['format'])
            except ExportFormatError:
                raise ValidationError("Unknown or invalid export format for the requested file.",
                                      params["format"])

        export_content = export.content.getvalue()
        checksum_sha256 = hashlib.sha256(export_content).digest()
        return make_cacheable_file_response(
            request,
            export_content,
            etag=checksum_sha256.hex(),
            filename=export.filename,
            mime_type=export.mime_type,
        )

    def get_all_linked_maps(
        self,
        file: Files,
        map_hash_set: set,
        files: list,
        link_to_page_map: dict
    ):
        current_user = g.current_user
        zip_file = zipfile.ZipFile(io.BytesIO(file.content.raw_file))
        try:
            json_graph = json.loads(zip_file.read('graph.json'))
        except KeyError:
            raise ValidationError
        for node in json_graph['nodes']:
            data = node['data']
            for link in data.get('sources', []) + data.get('hyperlinks', []):
                url = link.get('url', "").lstrip()
                match = MAPS_RE.match(url)
                if match:
                    map_hash = match.group('hash_id')
                    # Fetch linked maps and check permissions, before we start to export them
                    if map_hash not in map_hash_set:
                        try:
                            map_hash_set.add(map_hash)
                            child_file = self.get_nondeleted_recycled_file(
                                Files.hash_id == map_hash,
                                lazy_load_content=True
                            )
                            self.check_file_permissions(
                                [child_file], current_user, ['readable'],
                                permit_recycled=True
                            )
                            files.append(child_file)

                            files = self.get_all_linked_maps(
                                child_file, map_hash_set, files, link_to_page_map
                            )

                        except RecordNotFound:
                            current_app.logger.info(
                                f'Map file: {map_hash} requested for linked '
                                f'export does not exist.',
                                extra=UserEventLog(
                                    username=current_user.username,
                                    event_type=LogEventType.FILESYSTEM.value).to_dict()
                            )
                    destination_page = find_index(
                        lambda f: f.hash_id == map_hash,
                        files
                    )
                    if destination_page is not None:
                        link_to_page_map[(LIFELIKE_DOMAIN or '') + url] = destination_page
        return files


class FileBackupView(FilesystemBaseView):
    """Endpoint to manage 'backups' that are recorded for the user when they are editing a file
    so that they don't lose their work."""

    @use_args(FileBackupCreateRequestSchema, locations=['json', 'form', 'files', 'mixed_form_json'])
    def put(self, params: dict, hash_id: str):
        """Endpoint to create a backup for a file for a user."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=False)

        backup = FileBackup()
        backup.file = file

        # TODO: Make this into a function? @staticmethod of MapTypeProvider
        # or should I get the instance here?
        # Alternatively, we can zip those on the client side - but the JZip was working really slow
        if params['content_value'].content_type == FILE_MIME_TYPE_MAP:
            new_content = io.BytesIO()
            zip_content = zipfile.ZipFile(
                new_content,
                'w',
                zipfile.ZIP_DEFLATED,
                strict_timestamps=False
            )
            # NOTE: The trick here is that when we unpack zip on the client-side, we are not
            # resetting the image manager memory - we are only appending new stuff to it. This is
            # why we do not need to store all images within the backup - just the unsaved ones.
            zip_content.writestr('graph.json', params['content_value'].read())
            new_images = params.get('new_images') or []
            for image in new_images:
                zip_content.writestr('images/' + image.filename + '.png', image.read())
            zip_content.close()
            # Always seek before the read
            new_content.seek(0)
            backup.raw_value = new_content.read()
        else:
            backup.raw_value = params['content_value'].read()
        backup.user = current_user
        db.session.add(backup)
        db.session.commit()
        # rollback in case of error?

        return jsonify({})

    def delete(self, hash_id: str):
        """Get the backup stored for a file for a user."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        # They should only have a backup if the file was writable to them, so we're
        # only going to let users retrieve their backup if they can still write to the file
        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=False)

        file_backup_table = FileBackup.__table__
        db.session.execute(
            file_backup_table.delete().where(and_(file_backup_table.c.file_id == file.id,
                                                  file_backup_table.c.user_id ==
                                                  current_user.id))
        )
        db.session.commit()
        # rollback in case of error?

        return jsonify({})


class FileBackupContentView(FilesystemBaseView):
    """Endpoint to get the backup's content."""

    def get(self, hash_id):
        """Get the backup stored for a file for a user."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        # They should only have a backup if the file was writable to them, so we're
        # only going to let users retrieve their backup if they can still write to the file
        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=False)

        backup = db.session.query(FileBackup) \
            .options(raiseload('*')) \
            .filter(FileBackup.file_id == file.id,
                    FileBackup.user_id == current_user.id) \
            .order_by(desc_(FileBackup.creation_date)) \
            .first()

        if backup is None:
            raise RecordNotFound(
                title='Failed to Get File Backup',
                message='No backup stored for this file.',
                code=404)

        content = backup.raw_value
        etag = hashlib.sha256(content).hexdigest()

        return make_cacheable_file_response(
            request,
            content,
            etag=etag,
            filename=file.filename,
            mime_type=file.mime_type
        )


class FileVersionListView(FilesystemBaseView):
    """Endpoint to fetch the versions of a file."""

    @use_args(PaginatedRequestSchema)
    def get(self, pagination: dict, hash_id: str):
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=False)

        query = db.session.query(FileVersion) \
            .options(raiseload('*'),
                     joinedload(FileVersion.user)) \
            .filter(FileVersion.file_id == file.id) \
            .order_by(desc_(FileVersion.creation_date))

        result = query.paginate(pagination['page'], pagination['limit'])

        return jsonify(FileVersionHistorySchema(context={
            'user_privilege_filter': g.current_user.id,
        }).dump({
            'object': file,
            'total': result.total,
            'results': result.items,
        }))


class FileVersionContentView(FilesystemBaseView):
    """Endpoint to fetch a file version."""

    @use_args(PaginatedRequestSchema)
    def get(self, pagination: dict, hash_id: str):
        current_user = g.current_user

        file_version = db.session.query(FileVersion) \
            .options(raiseload('*'),
                     joinedload(FileVersion.user),
                     joinedload(FileVersion.content)) \
            .filter(FileVersion.hash_id == hash_id) \
            .one()

        file = self.get_nondeleted_recycled_file(Files.id == file_version.file_id)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=False)

        return file_version.content.raw_file


class FileLockBaseView(FilesystemBaseView):
    cutoff_duration = timedelta(minutes=5)

    def get_locks_response(self, hash_id: str):
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id)
        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=True)

        t_lock_user = aliased(AppUser)

        cutoff_date = datetime.now() - self.cutoff_duration

        query = db.session.query(FileLock) \
            .join(t_lock_user, t_lock_user.id == FileLock.user_id) \
            .options(contains_eager(FileLock.user, alias=t_lock_user)) \
            .filter(FileLock.hash_id == file.hash_id,
                    FileLock.acquire_date >= cutoff_date) \
            .order_by(desc_(FileLock.acquire_date))

        results = query.all()

        return jsonify(FileLockListResponse(context={
            'current_user': current_user,
        }).dump({
            'results': results,
        }))


class FileLockListView(FileLockBaseView):
    """Endpoint to get the locks for a file."""

    def get(self, hash_id: str):
        return self.get_locks_response(hash_id)

    @use_args(FileLockCreateRequest)
    def put(self, params: Dict, hash_id: str):
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id)
        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=True)

        acquire_date = datetime.now()
        cutoff_date = datetime.now() - self.cutoff_duration

        file_lock_table = FileLock.__table__
        stmt = insert(file_lock_table).returning(
            file_lock_table.c.user_id,
        ).values(hash_id=file.hash_id,
                 user_id=current_user.id,
                 acquire_date=acquire_date
                 ).on_conflict_do_update(
            index_elements=[
                file_lock_table.c.hash_id,
            ],
            set_={
                'acquire_date': datetime.now(),
                'user_id': current_user.id,
            },
            where=and_(
                file_lock_table.c.hash_id == hash_id,
                or_(file_lock_table.c.user_id == current_user.id,
                    file_lock_table.c.acquire_date < cutoff_date)
            ),
        )

        result = db.session.execute(stmt)
        lock_acquired = bool(len(list(result)))
        db.session.commit()
        # rollback in case of error?

        if lock_acquired:
            return self.get_locks_response(hash_id)
        else:
            return make_response(self.get_locks_response(hash_id), 409)

    @use_args(FileLockDeleteRequest)
    def delete(self, params: Dict, hash_id: str):
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id)
        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=True)

        file_lock_table = FileLock.__table__
        db.session.execute(
            file_lock_table.delete().where(and_(
                file_lock_table.c.hash_id == file.hash_id,
                file_lock_table.c.user_id == current_user.id))
        )
        db.session.commit()
        # rollback in case of error?

        return self.get_locks_response(hash_id)


class FileAnnotationHistoryView(FilesystemBaseView):
    """Implements lookup of a file's annotation history."""

    @use_args(PaginatedRequestSchema)
    def get(self, pagination: Dict, hash_id: str):
        """Get the annotation of a file."""
        user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id)
        self.check_file_permissions([file], user, ['readable'], permit_recycled=True)

        query = db.session.query(FileAnnotationsVersion) \
            .filter(FileAnnotationsVersion.file == file) \
            .order_by(desc_(FileAnnotationsVersion.creation_date)) \
            .options(joinedload(FileAnnotationsVersion.user))

        per_page = pagination['limit']
        page = pagination['page']

        total = query.order_by(None).count()
        if page == 1:
            items = itertools.chain(
                [file],
                query.limit(per_page).offset((page - 1) * per_page)
            )
        else:
            items = query.limit(per_page + 1).offset((page - 1) * per_page - 1)

        results = []

        for newer, older in window(items):
            results.append({
                'date': older.creation_date,
                'user': newer.user,
                'cause': older.cause,
                'inclusion_changes': self._get_annotation_changes(
                    older.custom_annotations, newer.custom_annotations, 'inclusion'),
                'exclusion_changes': self._get_annotation_changes(
                    older.excluded_annotations, newer.excluded_annotations, 'exclusion'),
            })

        return jsonify(FileAnnotationHistoryResponseSchema().dump({
            'total': total,
            'results': results,
        }))

    def _get_annotation_changes(
            self,
            older: List[Union[FileAnnotationsVersion, Files]],
            newer: List[Union[FileAnnotationsVersion, Files]],
            type: Union[Literal['inclusion'], Literal['exclusion']]
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
                    if key.startswith('***ARANGO_USERNAME***['):  # Only care about ***ARANGO_USERNAME*** changes right now
                        self._add_change(changes, action, annotation, type)

        return changes.values()

    def _add_change(
            self,
            changes: Dict[str, Dict],
            action: str,
            annotation: Dict,
            type: Union[Literal['inclusion'], Literal['exclusion']]
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
        starred_file_ids = db.session.query(
            StarredFile.file_id
        ).filter(
            StarredFile.user_id == user.id
        ).all()

        starred_files = self.get_nondeleted_recycled_files(
            filter=Files.id.in_([file_id for file_id, in starred_file_ids])
        )

        # TODO: Need to update get_nondeleted_recycled_files so that we can sort on these
        # calculated properties. For instance, we also cannnot sort/filter by project name.
        starred_files.sort(key=lambda f: f.calculated_starred['creation_date'], reverse=True)
        total = len(starred_files)

        return jsonify(FileListSchema(context={
            'user_privilege_filter': g.current_user.id,
        }, exclude=(
            'results.children',
        )).dump({
            'total': total,
            'results': starred_files,
        }))


class FileStarUpdateView(FilesystemBaseView):
    @use_args(lambda request: FileStarUpdateRequest(partial=True))
    def patch(self, params: dict, hash_id: str):
        user = g.current_user
        starred = params['starred']

        try:
            result = self.get_nondeleted_recycled_file(Files.hash_id == hash_id)
        except NoResultFound:
            raise RecordNotFound(
                title='Failed to Update File',
                message=f'Could not identify file with hash id {hash_id}',
            )

        # If the user doesn't have permission to read the file they want to star, we throw
        self.check_file_permissions([result], user, ['readable'], permit_recycled=False)

        if starred:
            # Don't need to update if the file is already starred by this user
            if result.calculated_starred is None:
                starred_file = StarredFile(
                    user_id=user.id,
                    file_id=result.id
                )
                db.session.add(starred_file)
                result.calculated_starred = starred_file
        # Delete the row only if it exists
        elif result.calculated_starred is not None:
            db.session.query(
                StarredFile
            ).filter(
                StarredFile.id == result.calculated_starred['id']
            ).delete()
            result.calculated_starred = None

        try:
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            raise

        return jsonify(FileResponseSchema(context={
            'user_privilege_filter': user.id,
        }, exclude=(
            'result.parent',
            'result.children',  # We aren't loading sub-children
        )).dump({
            'result': result,
        }))


# Use /content for endpoints that return binary data
bp.add_url_rule('objects', view_func=FileListView.as_view('file_list'))
bp.add_url_rule('objects/hierarchy', view_func=FileHierarchyView.as_view('file_hierarchy'))
bp.add_url_rule('search', view_func=FileSearchView.as_view('file_search'))
bp.add_url_rule('objects/<string:hash_id>', view_func=FileDetailView.as_view('file'))
bp.add_url_rule('objects/<string:hash_id>/content',
                view_func=FileContentView.as_view('file_content'))
bp.add_url_rule('objects/<string:hash_id>/map-content',
                view_func=MapContentView.as_view('map_content'))
bp.add_url_rule('objects/<string:hash_id>/export', view_func=FileExportView.as_view('file_export'))
bp.add_url_rule('objects/<string:hash_id>/backup', view_func=FileBackupView.as_view('file_backup'))
bp.add_url_rule('objects/<string:hash_id>/backup/content',
                view_func=FileBackupContentView.as_view('file_backup_content'))
bp.add_url_rule('objects/<string:hash_id>/versions',
                view_func=FileVersionListView.as_view('file_version_list'))
bp.add_url_rule('versions/<string:hash_id>/content',
                view_func=FileVersionContentView.as_view('file_version_content'))
bp.add_url_rule('/objects/<string:hash_id>/locks',
                view_func=FileLockListView.as_view('file_lock_list'))
bp.add_url_rule('/objects/<string:hash_id>/annotation-history',
                view_func=FileAnnotationHistoryView.as_view('file_annotation_history'))
bp.add_url_rule('/objects/starred',
                view_func=StarredFileListView.as_view('file_star_list'))
bp.add_url_rule('/objects/<string:hash_id>/star',
                view_func=FileStarUpdateView.as_view('file_star_update'))
