import os
import typing
import urllib
from collections import defaultdict
from pathlib import Path
from typing import List, Iterable, Optional, Tuple
from urllib.error import HTTPError

import gdown
import timeflake
from flask import g, jsonify
from marshmallow import ValidationError
from sqlalchemy import and_, asc as asc_, desc as desc_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import raiseload, joinedload, lazyload
from sqlalchemy.sql.expression import text

from neo4japp.blueprints.utils import get_missing_hash_ids
from neo4japp.constants import (
    SortDirection,
    MAX_FILE_SIZE,
    URL_FETCH_TIMEOUT,
    FILE_MIME_TYPE_PDF,
    FILE_MIME_TYPE_DIRECTORY,
    FILE_MIME_TYPE_BIOC,
)
from neo4japp.database import db, get_authorization_service, get_file_type_service
from neo4japp.exceptions import (
    AccessRequestRequiredError,
    RecordNotFound,
    FileNotFound,
    GDownException,
    UnsupportedMediaTypeError,
    ServerException,
    HandledException,
    ServerWarning,
)
from neo4japp.models import (
    Projects,
    Files,
    AppUser,
    FileContent,
)
from neo4japp.models.files_queries import (
    add_file_starred_columns,
    add_file_user_role_columns,
    build_file_hierarchy_query,
    FileHierarchy,
    add_file_size_column,
)
from neo4japp.models.projects_queries import add_project_user_role_columns
from neo4japp.schemas.filesystem import FileResponseSchema, MultipleFileResponseSchema
from neo4japp.utils.file_content_buffer import FileContentBuffer
from neo4japp.utils.globals import warn, get_current_user
from neo4japp.utils.network import read_url, ContentTooLongError


class Missing:
    def __bool__(self):
        return False


MISSING = Missing()


class Filesystem:
    """
    Filesystem service with methods for getting files
    from hash IDs, checking permissions, and validating input.
    """

    @staticmethod
    def get_nondeleted_recycled_file(
        filter, lazy_load_content=False, attr_excl: List[str] = None
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
        files = Filesystem.get_nondeleted_recycled_files(
            filter, lazy_load_content, attr_excl=attr_excl
        )
        if not len(files):
            raise FileNotFound()
        return files[0]

    @staticmethod
    def get_nondeleted_recycled_files(
        filter=None,
        lazy_load_content=False,
        require_hash_ids: List[str] = None,
        sort: List[str] = [],
        sort_direction: List[str] = [],
        attr_excl: List[str] = None,
    ) -> List[Files]:
        """
        Returns files that are guaranteed to be non-deleted, but may or may not be
        recycled, that matches the provided filter. If you do not want recycled files,
        exclude them with a filter condition.

        :param filter: the SQL Alchemy filter
        :param lazy_load_content: whether to load the file's content into memory
        :param require_hash_ids: a list of file hash IDs that must be in the result
        :param sort: str list of file attributes to order by
        :param sort_direction: Setup related sort columns either ASC or DESC
        :param attr_excl: list of file attributes to exclude from the query
        :return: the result, which may be an empty list
        """
        current_user = get_current_user()
        current_user_id = get_current_user('id')

        t_file = db.aliased(
            Files, name='_file'
        )  # alias required for the FileHierarchy class
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
                'Arguments `sort` and `sort_direction` should have an equal number'
                + 'of elements.'
            )
        sort_direction_fns = map(
            lambda dirxn: (desc_ if dirxn == SortDirection.DESC.value else asc_),
            sort_direction,
        )
        sort_map = zip(sort, sort_direction_fns)

        query = (
            build_file_hierarchy_query(
                and_(*filters), t_project, t_file, file_attr_excl=attr_excl
            )
            .options(raiseload('*'), joinedload(t_file.user))
            .order_by(*[dir_fn(text(f'_{col}')) for col, dir_fn in sort_map])
        )

        # Add extra boolean columns to the result indicating various permissions (read, write,
        # etc.) for the current user, which then can be read later by FileHierarchy or manually.
        # Note that file permissions are hierarchical (they are based on their parent folder and
        # also the project permissions), so you cannot just check these columns for ONE file to
        # determine a permission -- you also have to read all parent folders and the project!
        # Thankfully, we just loaded all parent folders and the project above, and so we'll use
        # the handy FileHierarchy class later to calculate this permission information.
        # Internal code of thi method is checking `isinstance(current_user, AppUser)` so we can not
        # use `current_user` LocalProxy here (LocalProxy is not an instance of AppUser)
        private_data_access = (
            get_authorization_service().has_role(g.current_user, 'private-data-access')
            if current_user
            else False
        )
        query = add_project_user_role_columns(
            query, t_project, current_user_id, access_override=private_data_access
        )
        query = add_file_user_role_columns(
            query, t_file, current_user_id, access_override=private_data_access
        )
        query = add_file_starred_columns(query, t_file.id, current_user_id)
        query = add_file_size_column(query, t_file.content_id)

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
        # projects are only linked to the root folder, and so you cannot just do Files.project).
        # We also calculate whether a file is recycled for cases when a file itself is not recycled,
        # but one of its parent folders is (NOTE: maybe in the future,
        # 'recycled' should not be inherited?)
        files = []
        for rows in grouped_results.values():
            hierarchy = FileHierarchy(rows, t_file, t_project)
            hierarchy.calculate_properties([current_user_id])
            hierarchy.calculate_privileges([current_user_id])
            hierarchy.calculate_starred_files()
            hierarchy.calculate_size()
            files.append(hierarchy.file)

        # Handle helper require_hash_ids argument that check to see if all files wanted
        # actually appeared in the results
        if require_hash_ids:
            missing_hash_ids = get_missing_hash_ids(require_hash_ids, files)

            if len(missing_hash_ids):
                raise RecordNotFound(
                    message=f"The request specified one or more file or directory "
                    f"({', '.join(missing_hash_ids)}) that could not be found."
                )

        # In the end, we just return a list of Files instances!
        return files

    @staticmethod
    def get_nondeleted_recycled_descendants(
        filter,
        lazy_load_content=False,
        require_hash_ids: List[str] = None,
        sort: List[str] = [],
        attr_excl: List[str] = None,
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

        t_file = db.aliased(
            Files, name='_file'
        )  # alias required for the FileHierarchy class
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
        query = (
            build_file_hierarchy_query(
                and_(filter, Files.deletion_date.is_(None)),
                t_project,
                t_file,
                file_attr_excl=attr_excl,
                direction='children',
            )
            .options(raiseload('*'), joinedload(t_file.user))
            .order_by(*[text(f'_file.{col}') for col in sort])
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
        query = add_project_user_role_columns(
            query, t_project, current_user.id, access_override=private_data_access
        )
        query = add_file_user_role_columns(
            query, t_file, current_user.id, access_override=private_data_access
        )

        if lazy_load_content:
            query = query.options(lazyload(t_file.content))

        # In the end, we just return a list of Files instances!
        return [row[0] for row in query.all()]

    @staticmethod
    def check_file_permissions(
        files: List[Files],
        user: Optional[AppUser],
        require_permissions: List[str],
        *,
        permit_recycled: bool,
    ):
        """
        Helper method to check permissions on the provided files and other properties
        that you may want to check for. On error, an exception is thrown.

        :param files: the files to check
        :param user: the user to check permissions for
        :param require_permissions: a list of permissions to require (like 'writable')
        :param permit_recycled: whether to allow recycled files
        """
        user_id = user.id if user else None
        # Check each file
        for file in files:
            for permission in require_permissions:
                if not getattr(file.calculated_privileges[user_id], permission):
                    # Do not reveal the filename with the error!
                    # TODO: probably refactor these readable, commentable to
                    # actual string values...

                    if not file.calculated_privileges[user_id].readable:
                        raise AccessRequestRequiredError(
                            curr_access='no',
                            req_access='readable',
                            hash_id=file.hash_id,
                        )
                    else:
                        if permission == 'commentable':
                            raise AccessRequestRequiredError(
                                curr_access='commentable',
                                req_access='writable',
                                hash_id=file.hash_id,
                            )
                        else:
                            raise AccessRequestRequiredError(
                                curr_access='readable',
                                req_access='writable',
                                hash_id=file.hash_id,
                            )

            if not permit_recycled and (file.recycled or file.parent_recycled):
                raise ValidationError(
                    f"The file or directory '{file.filename}' has been trashed and "
                    "must be restored first."
                )

    @staticmethod
    def get_file_response(hash_id: str, user: AppUser = None):
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
        return_file = Filesystem.get_nondeleted_recycled_file(
            Files.hash_id == hash_id, attr_excl=EXCLUDE_FIELDS
        )
        Filesystem.check_file_permissions(
            [return_file], user, ['readable'], permit_recycled=True
        )

        children = Filesystem.get_nondeleted_recycled_files(
            and_(
                Files.parent_id == return_file.id,
                Files.recycling_date.is_(None),
            ),
            attr_excl=EXCLUDE_FIELDS,
        )
        # Note: We don't check permissions here, but there are no negate permissions
        return_file.calculated_children = children

        return jsonify(
            FileResponseSchema(
                context={
                    'user_privilege_filter': get_current_user('id'),
                },
                exclude=('result.children.children',),  # We aren't loading sub-children
            ).dump(
                {
                    'result': return_file,
                }
            )
        )

    @staticmethod
    def get_bulk_file_response(
        hash_ids, user: AppUser, missing_hash_ids: Iterable[str] = None
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
        files = Filesystem.get_nondeleted_recycled_files(Files.hash_id.in_(hash_ids))
        Filesystem.check_file_permissions(
            files, user, ['readable'], permit_recycled=True
        )

        returned_files = {}

        for file in files:
            if file.calculated_privileges[user.id].readable:
                returned_files[file.hash_id] = file

        return jsonify(
            MultipleFileResponseSchema(
                context={
                    'user_privilege_filter': user.id,
                },
                exclude=('mapping.children',),
            ).dump(
                dict(
                    mapping=returned_files,
                    missing=list(missing_hash_ids)
                    if missing_hash_ids is not None
                    else [],
                )
            )
        )

    file_max_size = MAX_FILE_SIZE
    url_fetch_timeout = URL_FETCH_TIMEOUT
    url_fetch_user_agent = (
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36 Lifelike'
    )

    @classmethod
    def _get_content(
        cls,
        content_url: Optional[str] = None,
        content_value: Optional[Iterable[bytes]] = None,
    ) -> Tuple[FileContentBuffer, Optional[str]]:
        url = content_url
        buffer = content_value

        # Fetch from URL
        if url is not None:
            try:
                response_buffer = FileContentBuffer(max_size=cls.file_max_size)
                # Note that in the future, we may wish to upload files of many different types
                # from URL. Limiting ourselves to merely PDFs is a little short-sighted, but for
                # now it is the expectation.
                if urllib.parse.urlparse(url).netloc == 'drive.google.com':
                    buffer = gdown.download(url, response_buffer, fuzzy=True)
                    if buffer is None:
                        # currently gdown fails silently - wrote path for it
                        # https://github.com/wkentaro/gdown/pull/244
                        # if they do not accept we should consider ussing fork
                        raise GDownException()
                    file_type_service = get_file_type_service()
                    if file_type_service.detect_mime_type(buffer) != FILE_MIME_TYPE_PDF:
                        raise UnsupportedMediaTypeError()
                else:
                    buffer = read_url(
                        url=url,
                        headers={
                            'User-Agent': cls.url_fetch_user_agent,
                            'Accept': FILE_MIME_TYPE_PDF,
                        },
                        buffer=response_buffer,
                        max_length=cls.file_max_size,
                        prefer_direct_downloads=True,
                        timeout=cls.url_fetch_timeout,
                    )
            except UnsupportedMediaTypeError as e:
                # The server did not respect our request for a PDF and did not throw a 406, so
                # instead we have thrown a 415 to prevent non-pdf documents from being uploaded.
                raise ServerException(
                    message='Your file could not be uploaded. Please make sure your URL ends '
                    + 'with .pdf. For example, https://www.example.com/file.pdf. If the '
                    + 'problem persists, please download the file to your computer from '
                    + 'the original website and upload the file from your device.',
                    code=e.code,
                ) from e
            except (HTTPError, GDownException) as http_err:
                # Should be raised because of the 'Accept' content type header above.
                if http_err.code == 406:
                    raise ServerException(
                        message='Your file could not be uploaded. Please make sure your URL ends '
                        + 'with .pdf. For example, https://www.example.com/file.pdf. If '
                        + 'the problem persists, please download the file to your '
                        + 'computer from the original website and upload the file from '
                        + 'your device.',
                    ) from http_err
                else:
                    # An error occurred that we were not expecting.
                    raise ServerException(
                        message='Your file could not be uploaded due to an unexpected error, '
                        + 'please try again. If the problem persists, please download the '
                        + 'file to your computer from the original website and upload the '
                        + 'file from your device.'
                    ) from http_err
            except (ContentTooLongError, OverflowError) as e:
                raise ServerException(
                    message='Your file could not be uploaded. The requested file is too large. '
                    + 'Please limit file uploads to less than 315MB.',
                ) from e

            return typing.cast(FileContentBuffer, buffer), url

        # Fetch from upload
        elif buffer is not None:
            return FileContentBuffer(stream=buffer), None
        else:
            return FileContentBuffer(), None

    @classmethod
    def create_file(
        cls,
        filename,
        *,
        parent,
        description=MISSING,
        public=False,
        content_hash_id=None,
        content_url=None,
        content_value=None,
        mime_type=None,
        fallback_organism=None,
        contexts=MISSING,
        annotation_configs=None,
    ) -> Files:
        """Method to create a new file or to clone a file into a new one."""

        current_user = g.current_user
        file_type_service = get_file_type_service()

        file = Files()
        file.filename = (
            timeflake.random().base62 + filename
        )  # placeholder filename - without name conflict
        file.description = description if description is not MISSING else None
        file.user = current_user
        file.creator = current_user
        file.modifier = current_user
        file.public = public

        # TODO: Check max hierarchy depth

        file.parent = parent

        # ========================================
        # Resolve file content
        # ========================================

        # Clone operation
        if content_hash_id is not None:
            source_hash_id: Optional[str] = content_hash_id

            try:
                existing_file = Filesystem.get_nondeleted_recycled_file(
                    Files.hash_id == source_hash_id
                )
                Filesystem.check_file_permissions(
                    [existing_file], current_user, ['readable'], permit_recycled=True
                )
            except RecordNotFound as e:
                raise ValidationError(
                    f"The requested file or directory to clone from "
                    f"({source_hash_id}) could not be found.",
                    "content_hash_id",
                ) from e

            if existing_file.mime_type == FILE_MIME_TYPE_DIRECTORY:
                raise ValidationError(
                    f"The specified clone source ({source_hash_id}) "
                    f"is a folder and that is not supported.",
                    "mime_type",
                )

            file.mime_type = existing_file.mime_type
            file.doi = existing_file.doi
            file.annotations = existing_file.annotations
            file.annotations_date = existing_file.annotations_date
            file.custom_annotations = existing_file.custom_annotations
            file.upload_url = existing_file.upload_url
            file.excluded_annotations = existing_file.excluded_annotations
            file.content_id = existing_file.content_id

            if description is MISSING:
                file.description = existing_file.description

        # Create operation
        else:
            buffer, url = Filesystem._get_content(
                content_url=content_url, content_value=content_value
            )

            # Check max file size
            if buffer.size > cls.file_max_size:
                raise ValidationError(
                    'Your file could not be processed because it is too large.'
                )

            # Save the URL
            file.upload_url = url

            # Detect mime type
            if mime_type:
                file.mime_type = mime_type
            else:
                extension = None
                try:
                    extension = file.extension or Path(content_value.filename).suffix
                except Exception:
                    pass

                mime_type = file_type_service.detect_mime_type(buffer, extension)
                file.mime_type = mime_type

            # Get the provider based on what we know now
            provider = file_type_service.get(file.mime_type)
            # if no provider matched try to convert

            # if it is a bioc-xml file
            if file.mime_type == FILE_MIME_TYPE_BIOC:
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
                provider = file_type_service.get(file.mime_type)
                provider.convert(buffer)

            # Check if the user can even upload this type of file
            if not provider.can_create():
                raise ValidationError(f"The provided file type is not accepted.")

            # Validate the content
            try:
                provider.validate_content(buffer, log_status_messages=True)
            except ValueError as e:
                raise ValidationError(f"The provided file may be corrupt: {str(e)}")
            except HandledException:
                pass
            else:
                provider.load(buffer, file)
                try:
                    # Get the DOI only if content could be validated
                    file.doi = provider.extract_doi(buffer)
                except ServerWarning as w:
                    warn(w)

            # Save the file content if there's any
            if buffer.size:
                file.content_id = FileContent.get_or_create(buffer)
                try:
                    buffer.close()
                except Exception:
                    pass

        # ========================================
        # Annotation options
        # ========================================

        if fallback_organism:
            file.organism_name = fallback_organism['organism_name']
            file.organism_synonym = fallback_organism['synonym']
            file.organism_taxonomy_id = fallback_organism['tax_id']

        if contexts is not MISSING:
            file.contexts = contexts

        if annotation_configs:
            file.annotation_configs = annotation_configs

        # ========================================
        # Commit and filename conflict resolution
        # ========================================

        savepoint = db.session.begin_nested()  # Make checkpoint for rollback
        # Filenames could conflict, so we may need to generate a new filename
        # Trial 1: First attempt
        # Trial 2: Try adding (N+1) to the filename and try again
        # Trial 3: Try adding (N+1) to the filename and try again (in case of a race condition)
        # Trial 4: Give up
        # Trial 3 only does something if the transaction mode is in READ COMMITTED or worse (!)
        for trial in range(4):
            try:
                if trial == 0:
                    file.filename = filename  # Set initial filename
                if 1 <= trial <= 2:  # Try adding (N+1)
                    try:
                        file.filename = file.generate_non_conflicting_filename(filename)
                    except ValueError as e:
                        raise ValidationError(
                            'Filename conflicts with an existing file in the same folder.',
                            "filename",
                        ) from e
                elif trial == 3:  # Give up
                    raise ValidationError(
                        'Filename conflicts with an existing file in the same folder.',
                        "filename",
                    )

                db.session.flush()
            except IntegrityError as e:
                savepoint.rollback()
                # Warning: this could catch some other integrity error
                pass
            else:
                break

        # ========================================
        # Return new file
        # ========================================

        return file
