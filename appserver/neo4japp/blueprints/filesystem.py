import hashlib
import io
import json
import re
import urllib.request
from collections import defaultdict
from datetime import datetime
from typing import Optional, List, Dict, Iterable, Sequence
from urllib.error import URLError

import graphviz
from flask import Blueprint, jsonify, g, request
from flask.views import MethodView
from marshmallow import ValidationError
from pdfminer import high_level
from sqlalchemy import and_, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import raiseload, joinedload, lazyload, aliased, contains_eager
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.constants import ANNOTATION_STYLES_DICT
from neo4japp.database import db
from neo4japp.exceptions import RecordNotFoundException, AccessRequestRequiredError
from neo4japp.models import Projects, Files, FileContent, AppUser, FileVersion, FileBackup
from neo4japp.models.files_queries import add_user_permission_columns, FileHierarchy, \
    build_file_hierarchy_query, build_file_children_cte
from neo4japp.schemas.common import PaginatedRequest
from neo4japp.schemas.filesystem import FileUpdateRequestSchema, FileResponse, FileResponseSchema, \
    FileCreateRequestSchema, BulkFileRequestSchema, MultipleFileResponseSchema, BulkFileUpdateRequestSchema, \
    FileListSchema, FileSearchRequestSchema, FileBackupCreateRequestSchema, FileVersionHistorySchema, \
    FileExportRequestSchema
from neo4japp.schemas.formats.drawing_tool import validate_map_data
from neo4japp.utils.http import make_cacheable_file_response
from neo4japp.utils.network import read_url

bp = Blueprint('filesystem', __name__, url_prefix='/filesystem')


# When working with files, remember that:
# - They may be recycled
# - They may be deleted
# - The project that the files are in may be recycled


class FilesystemBaseView(MethodView):
    """
    Base view for filesystem endpoints with reusable methods for getting files
    from hash IDs, checking permissions, and validating input.
    """

    file_max_size = 1024 * 1024 * 30
    url_fetch_timeout = 10
    url_fetch_user_agent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' \
                           'Chrome/51.0.2704.103 Safari/537.36 Lifelike'
    accepted_mime_types = {
        'applicatiom/pdf',
        'vnd.***ARANGO_DB_NAME***.document/map',
        'vnd.***ARANGO_DB_NAME***.filesystem/directory'
    }
    extension_mime_types = {
        '.pdf': 'application/pdf',
        '.llmap': 'vnd.***ARANGO_DB_NAME***.document/map',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        # TODO: Use a mime type library?
    }
    content_validators = {
        'application/pdf': lambda buffer: True,
        'vnd.***ARANGO_DB_NAME***.document/map': validate_map_data,
        'vnd.***ARANGO_DB_NAME***.filesystem/directory': lambda buffer: buffer is None,
    }

    def get_nondeleted_recycled_file(self, filter, lazy_load_content=False) -> Files:
        """
        Returns a file that is guaranteed to be non-deleted, but may or may not be
        recycled, that matches the provided filter. If you do not want recycled files,
        exclude them with a filter condition.

        :param filter: the SQL Alchemy filter
        :param lazy_load_content: whether to load the file's content into memory
        :return: a non-null file
        """
        files = self.get_nondeleted_recycled_files(filter, lazy_load_content)
        if not len(files):
            raise RecordNotFoundException("The requested file object could not be found.")
        return files[0]

    def get_nondeleted_recycled_files(self, filter, lazy_load_content=False,
                                      require_hash_ids: List[str] = None) -> List[Files]:
        """
        Returns files that are guaranteed to be non-deleted, but may or may not be
        recycled, that matches the provided filter. If you do not want recycled files,
        exclude them with a filter condition.

        :param filter: the SQL Alchemy filter
        :param lazy_load_content: whether to load the file's content into memory
        :param require_hash_ids: a list of file hash IDs that must be in the result
        :return: the result, which may be an empty list
        """
        current_user = g.current_user

        t_file = db.aliased(Files, name='_file')  # alias required for the FileHierarchy class
        t_project = db.aliased(Projects, name='_project')

        query = build_file_hierarchy_query(and_(
            filter,
            Files.deletion_date.is_(None)
        ), t_project, t_file) \
            .options(raiseload('*'),
                     joinedload(t_file.user),
                     joinedload(t_file.fallback_organism))

        # Fetch permissions for the given user
        query = add_user_permission_columns(query, t_project, t_file, current_user.id)

        if lazy_load_content:
            query = query.options(lazyload(t_file.content))

        results = query.all()
        grouped_results = defaultdict(lambda: [])
        files = []

        for row in results:
            grouped_results[row._asdict()['initial_id']].append(row)

        for rows in grouped_results.values():
            hierarchy = FileHierarchy(rows, t_file, t_project)
            hierarchy.calculate_properties()
            hierarchy.calculate_privileges([current_user.id])
            files.append(hierarchy.file)

        if require_hash_ids:
            missing_hash_ids = self.get_missing_hash_ids(require_hash_ids, files)

            if len(missing_hash_ids):
                raise RecordNotFoundException(f"The request specified one or more file or directory "
                                              f"({', '.join(missing_hash_ids)}) that could not be found.")

        return files

    def get_nondeleted_recycled_children(self, filter, children_filter=None,
                                         lazy_load_content=False) -> List[Files]:
        """
        Retrieve all files that match the provided filter, including the children of those
        files, even if those children do not match the filter. The files returned by
        this method do not have complete information to determine permissions.

        :param filter: the SQL Alchemy filter
        :param lazy_load_content: whether to load the file's content into memory
        :return: the result, which may be an empty list
        """
        q_hierarchy = build_file_children_cte(and_(
            filter,
            Files.deletion_date.is_(None)
        ))

        t_parent_files = aliased(Files)

        query = db.session.query(Files) \
            .join(q_hierarchy, q_hierarchy.c.id == Files.id) \
            .outerjoin(t_parent_files, t_parent_files.id == Files.parent_id) \
            .options(raiseload('*'),
                     contains_eager(Files.parent, alias=t_parent_files),
                     joinedload(Files.user),
                     joinedload(Files.fallback_organism)) \
            .order_by(q_hierarchy.c.level)

        if children_filter:
            query = query.filter(children_filter)

        if lazy_load_content:
            query = query.options(lazyload(Files.content))

        return query.all()

    def check_file_permissions(self, files: List[Files], user: AppUser,
                               require_permissions: List[str], *, permit_recycled: bool):
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
                    raise AccessRequestRequiredError(
                        f"You do not have access to the specified file object "
                        f"(with ID of {file.hash_id}) to change it.", file.hash_id)

            if not permit_recycled and (file.recycled or file.parent_recycled):
                raise ValidationError(f"The file or directory '{file.filename}' has been trashed and "
                                      "must be restored first.")

    def check_recursive_selection_permission(self, user: AppUser):
        raise ValidationError(f'Recursive selection is not permitted.', "recursive")

    def update_files(self, hash_ids: List[str], params: Dict, user: AppUser, *,
                     recursive=False):
        """
        Updates the specified files using the parameters from a validated request.

        :param hash_ids: the object hash IDs
        :param params: the parameters
        :param user: the user that is making the change
        :param recursive: apply settings to children of folders
        """
        changed_fields = set()

        # Collect everything that we need to query
        target_hash_ids = set(hash_ids)
        parent_hash_id = params.get('parent_hash_id')

        query_hash_ids = hash_ids[:]
        require_hash_ids = []

        if parent_hash_id is not None:
            query_hash_ids.append(parent_hash_id)
            require_hash_ids.append(parent_hash_id)

        # ========================================
        # Fetch and check
        # ========================================

        files = self.get_nondeleted_recycled_files(Files.hash_id.in_(query_hash_ids),
                                                   require_hash_ids=require_hash_ids)
        self.check_file_permissions(files, user, ['writable'], permit_recycled=False)

        # This flag allows a user to update all files within a folder (however
        # deep the folder hierarchy may get) by simply selecting the folder
        if recursive:
            self.check_recursive_selection_permission(user)
            files = self.get_nondeleted_recycled_children(Files.id.in_([file.id for file in files]),
                                                          lazy_load_content=True)

        target_files = [file for file in files if file.hash_id != parent_hash_id]
        parent_file = None
        missing_hash_ids = self.get_missing_hash_ids(query_hash_ids, files)

        # Prevent recursive parent hash IDs
        if parent_hash_id is not None and parent_hash_id in [file.hash_id for file in target_files]:
            raise ValidationError(f'An object cannot be set as the parent of itself.',
                                  "parent_hash_id")

        # Check the specified parent to see if it can even be a parent
        if parent_hash_id is not None:
            parent_file = next(filter(lambda file: file.hash_id == parent_hash_id, files), None)

            if parent_file.mime_type != Files.DIRECTORY_MIME_TYPE:
                raise ValidationError(f"The specified parent ({parent_hash_id}) is "
                                      f"not a folder. It is a file, and you cannot make files "
                                      f"become a child of another file.", "parent_hash_id")

        if 'content_value' in params and len(target_files) > 1:
            # We don't allow multiple files to be changed due to a potential deadlock
            # in FileContent.get_or_create(), and also because it's a weird use case
            raise NotImplementedError("Cannot update the content of multiple files with this method")

        # ========================================
        # Apply
        # ========================================

        for file in target_files:
            is_***ARANGO_USERNAME***_dir = (file.calculated_project.***ARANGO_USERNAME***_id == file.id)

            if 'description' in params:
                if file.description != params['description']:
                    file.description = params['description']
                    changed_fields.add('description')

            # Some changes cannot be applied to ***ARANGO_USERNAME*** directories
            if not is_***ARANGO_USERNAME***_dir:
                if parent_hash_id is not None:
                    # Re-check referential parent
                    if file.id == parent_file.id:
                        raise ValidationError(f'A file or folder ({file.filename}) cannot be '
                                              f'set as the parent of itself.', "parent_hash_id")

                    # TODO: Check max hierarchy depth

                    # Check for circular inheritance
                    current_parent = parent_file.parent
                    while current_parent:
                        if current_parent.hash_id == file.hash_id:
                            raise ValidationError(f"If the parent of '{file.filename}' was set to "
                                                  f"'{parent_file.filename}', it would result in circular"
                                                  f"inheritance.", "parent_hash_id")
                        current_parent = current_parent.parent

                    file.parent = parent_file
                    changed_fields.add('parent')

                if 'filename' in params:
                    file.filename = params['filename']
                    changed_fields.add('filename')

                if 'public' in params:
                    if file.public != params['public']:
                        file.public = params['public']
                        changed_fields.add('public')

                if 'content_value' in params:
                    buffer = params['content_value']
                    buffer.seek(0, io.SEEK_END)
                    size = buffer.tell()
                    buffer.seek(0)

                    if size > self.file_max_size:
                        raise ValidationError('Your file could not be processed because it is too large.',
                                              "content_value")

                    try:
                        self.validate_content(file.mime_type, buffer)
                    except ValueError:
                        raise ValidationError(f"The provided file may be corrupt for files of type "
                                              f"'{file.mime_type}' (which '{file.hash_id}' is of).",
                                              "content_value")

                    new_content_id = FileContent.get_or_create(buffer)
                    buffer.seek(0)

                    # Only make a file version if the content actually changed
                    if file.content_id != new_content_id:
                        # Create file version
                        version = FileVersion()
                        version.file = file
                        version.content_id = file.content_id
                        version.user = user
                        db.session.add(version)

                        file.content_id = new_content_id
                        changed_fields.add('content_value')

            file.modifier = user

        if len(changed_fields):
            try:
                db.session.commit()
            except IntegrityError as e:
                raise ValidationError("The requested changes would result in a duplicate filename "
                                      "within the same folder.")

        return missing_hash_ids

    def get_file_response(self, hash_id: str, user: AppUser):
        """
        Fetch a file and return a response that can be sent to the client. Permissions
        are checked and this method will throw a relevant response exception.

        :param hash_id: the hash ID of the file
        :param user: the user to check permissions for
        :return: the response
        """
        return_file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id)
        self.check_file_permissions([return_file], user, ['readable'], permit_recycled=True)

        children = self.get_nondeleted_recycled_files(and_(
            Files.parent_id == return_file.id,
            Files.recycling_date.is_(None),
        ))
        # Note: We don't check permissions here, but there are no negate permissions

        return_file.calculated_children = children

        return jsonify(FileResponseSchema(context={
            'user_privilege_filter': g.current_user.id,
        }, exclude=(
            'object.children.children',  # We aren't loading sub-children
        )).dump(FileResponse(
            object=return_file,
        )))

    def get_bulk_file_response(self, hash_ids: List[str], user: AppUser, *,
                               missing_hash_ids: Iterable[str] = None):
        """
        Fetch several files and return a response that can be sent to the client. Could
        possibly return a response with an empty list if there were no matches. Permissions
        are checked and this method will throw a relevant response exception.

        :param hash_ids: the hash IDs of the files
        :param user: the user to check permissions for
        :return: the response
        """
        files = self.get_nondeleted_recycled_files(Files.hash_id.in_(hash_ids),
                                                   require_hash_ids=hash_ids)
        self.check_file_permissions(files, user, ['readable'], permit_recycled=True)

        returned_files = {}

        for file in files:
            if file.calculated_privileges[user.id].readable:
                returned_files[file.hash_id] = file

        return jsonify(MultipleFileResponseSchema(context={
            'user_privilege_filter': user.id,
        }, exclude=(
            'objects.children',
        )).dump(dict(
            objects=returned_files,
            missing=list(missing_hash_ids) or [],
        )))

    def detect_mime_type(self, buffer):
        try:
            json.load(buffer)
            return 'vnd.***ARANGO_DB_NAME***.document/map'
        except ValueError:
            return 'application/pdf'
        finally:
            buffer.seek(0)

    def validate_content(self, mime_type, buffer):
        validator = self.content_validators[mime_type]
        if not validator(buffer):
            raise ValueError()

    def extract_doi(self, mime_type, buffer):
        if mime_type == 'application/pdf':
            data = buffer.read()
            buffer.seek(0)

            # Attempt 1: search through the first N bytes (most probably containing only metadata)
            chunk = data[:2 ** 17]
            doi = self._search_doi_in_pdf(chunk)
            if doi is not None:
                return doi

            # Attempt 2: search through the first two pages of text (no metadata)
            fp = io.BytesIO(data)
            text = high_level.extract_text(fp, page_numbers=[0, 1], caching=False)
            doi = self._search_doi_in_pdf(bytes(text, encoding='utf8'))
            if doi is not None:
                return doi

        return None

    def _search_doi_in_pdf(self, content: bytes) -> Optional[str]:
        # ref: https://stackoverflow.com/a/10324802
        # Has a good breakdown of the DOI specifications,
        # in case need to play around with the regex in the future
        doi_re = rb'(?i)(?:doi:\s*|https?:\/\/doi\.org\/)(10[.][0-9]{4,}(?:[.][0-9]+)*\/(?:(?!["&\'<>])\S)+)\b'  # noqa
        match = re.search(doi_re, content)

        if match is None:
            return None
        doi = match.group(1).decode('utf-8').replace('%2F', '/')
        # Make sure that the match does not contain undesired characters at the end.
        # E.g. when the match is at the end of a line, and there is a full stop.
        while doi and doi[-1] in './%':
            doi = doi[:-1]
        return doi if doi.startswith('http') else f'https://doi.org/{doi}'

    def get_missing_hash_ids(self, expected_hash_ids: Iterable[str], files: Iterable[Files]):
        found_hash_ids = set(file.hash_id for file in files)
        missing = set()
        for hash_id in expected_hash_ids:
            if hash_id not in found_hash_ids:
                missing.add(hash_id)
        return missing


class FileListView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(FileCreateRequestSchema, locations=['json', 'form', 'files', 'mixed_form_json'])
    def post(self, params: dict):
        """Endpoint to create a new file or to clone a file into a new one."""

        current_user = g.current_user

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
        except RecordNotFoundException:
            # Rewrite the error to make more sense
            raise ValidationError("The requested parent object could not be found.",
                                  "parent_hash_id")

        if parent.mime_type != Files.DIRECTORY_MIME_TYPE:
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
            source_hash_id: str = params.get("content_hash_id")

            try:
                existing_file = self.get_nondeleted_recycled_file(Files.hash_id == source_hash_id)
                self.check_file_permissions([existing_file], current_user, ['readable'],
                                            permit_recycled=True)
            except RecordNotFoundException:
                raise ValidationError(f"The requested file or directory to clone from "
                                      f"({source_hash_id}) could not be found.",
                                      "content_hash_id")

            if existing_file.mime_type == Files.DIRECTORY_MIME_TYPE:
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
            content_field, buffer, url = self._get_content_from_params(params)

            if content_field:
                buffer.seek(0, io.SEEK_END)
                size = buffer.tell()
                buffer.seek(0)

                if size == 0:
                    raise ValidationError('The file is blank.', content_field)

                if size > self.file_max_size:
                    raise ValidationError('Your file could not be processed because it is too large.', content_field)

                if params.get('mime_type'):
                    file.mime_type = params['mime_type']
                else:
                    try:
                        file.mime_type = self.detect_mime_type(buffer)
                    except ValueError as e:
                        raise ValidationError("The type of file could not be detected.", content_field)

                file.doi = self.extract_doi(file.mime_type, buffer)
                file.content_id = FileContent.get_or_create(buffer)
                file.url = url
            else:
                file.mime_type = params['mime_type']

            try:
                self.validate_content(file.mime_type, buffer)
            except ValueError as e:
                raise ValidationError(f"The provided file may be corrupt: {str(e)}", content_field)

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
                    raise ValidationError('Filename conflicts with an existing file in the same folder.',
                                          "filename")
            elif trial == 3:  # Give up
                raise ValidationError('Filename conflicts with an existing file in the same folder.',
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

        current_user = g.current_user
        missing_hash_ids = self.update_files(targets['hash_ids'], params, current_user,
                                             recursive=targets.get('recursive', False))
        return self.get_bulk_file_response(targets['hash_ids'], current_user,
                                           missing_hash_ids=missing_hash_ids)

    # noinspection DuplicatedCode
    @use_args(lambda request: BulkFileRequestSchema())
    def delete(self, targets):
        """File delete endpoint."""

        current_user = g.current_user

        hash_ids = targets['hash_ids']

        files = self.get_nondeleted_recycled_files(Files.hash_id.in_(hash_ids))
        self.check_file_permissions(files, current_user, ['writable'], permit_recycled=True)

        missing_hash_ids = self.get_missing_hash_ids(hash_ids, files)

        # ========================================
        # Apply
        # ========================================

        for file in files:
            if file.calculated_project.***ARANGO_USERNAME***_id == file.id:
                raise ValidationError(f"You cannot delete the ***ARANGO_USERNAME*** directory "
                                      f"for a project (the folder for the project "
                                      f"'{file.calculated_project.name}' was specified).")

            if not file.recycled:
                file.recycling_date = datetime.now()
                file.recycler = current_user
                file.modifier = current_user

        db.session.commit()

        # ========================================
        # Return changed files
        # ========================================

        return self.get_bulk_file_response(hash_ids, current_user,
                                           missing_hash_ids=missing_hash_ids)

    def _get_content_from_params(self, params: dict):
        # Fetch from URL
        if params.get('content_url') is not None:
            url: str = params.get('content_url')

            try:
                buffer = read_url(urllib.request.Request(url, headers={
                    'User-Agent': self.url_fetch_user_agent,
                }), max_length=self.file_max_size, timeout=self.url_fetch_timeout)
            except (ValueError, URLError):
                raise ValidationError('Your file could not be downloaded, either because it is '
                                      'inaccessible or another problem occurred. Please double '
                                      'check the spelling of the URL.', "content_url")

            return 'content_url', buffer, url

        # Fetch from upload
        elif params.get('content_value') is not None:
            buffer = params.get('content_value')
            return 'content_value', buffer, None
        else:
            return None, None, None


class FileSearchView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(FileSearchRequestSchema)
    @use_args(PaginatedRequest)
    def post(self, params: dict, pagination: dict):
        current_user = g.current_user

        if params['type'] == 'public':
            # First we query for public files without getting parent directory
            # or project information
            query = db.session.query(Files.id) \
                .filter(Files.recycling_date.is_(None),
                        Files.deletion_date.is_(None),
                        Files.public.is_(True),
                        Files.mime_type.in_(params['mime_types'])) \
                .order_by(*params['sort'])

            result = query.paginate(pagination['page'], pagination['limit'])

            # Now we get the full file information for this slice of the results
            files = self.get_nondeleted_recycled_files(Files.id.in_(result.items))
            total = result.total

        elif params['type'] == 'linked':
            hash_id = params['linked_hash_id']
            file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
            self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)

            # Don't support pagination yet
            limit = 5
            offset = 0

            # TODO: Improve the performance of this query
            # Getting the ***ARANGO_USERNAME***s and then parsing the JSON is not efficient

            base_query = f"""
                WITH RECURSIVE _***ARANGO_USERNAME***s AS (
                    SELECT
                        file.id AS file_id
                        , file.parent_id
                        , project.id AS project_id
                        , file.id AS ***ARANGO_USERNAME***_id
                        , 0 AS level
                    FROM files file
                    LEFT JOIN projects project on project.***ARANGO_USERNAME***_id = file.id
                    WHERE
                        file.parent_id IS NULL
                
                    UNION ALL
                
                    SELECT
                        child.id AS file_id
                        , child.parent_id
                        , parent.project_id
                        , parent.***ARANGO_USERNAME***_id
                        , parent.level + 1 AS level
                    FROM _***ARANGO_USERNAME***s parent
                    INNER JOIN files child ON child.parent_id = parent.file_id
                )
                , _maps AS (
                    SELECT
                        file.id AS file_id
                        , convert_from(content.raw_file, 'UTF-8')::jsonb AS parsed_content
                    FROM files file
                    INNER JOIN files_content content ON content.id = file.content_id
                    WHERE
                        file.mime_type = 'vnd.***ARANGO_DB_NAME***.document/map'
                        AND file.deletion_date IS NULL
                        AND file.recycling_date IS NULL
                )
                SELECT
                    DISTINCT
                    {'{select}'}
                FROM (
                    SELECT
                        map.file_id
                        , data
                    FROM _maps map
                    CROSS JOIN jsonb_to_recordset(jsonb_extract_path(map.parsed_content, 'nodes')) AS data(data JSONB)
                    UNION ALL
                    SELECT
                        map.file_id
                        , data
                    FROM _maps map
                    CROSS JOIN jsonb_to_recordset(jsonb_extract_path(map.parsed_content, 'edges')) AS data(data JSONB)
                ) data
                CROSS JOIN jsonb_to_recordset(jsonb_extract_path(data.data, 'sources')) AS source(url VARCHAR)
                INNER JOIN files file ON file.id = data.file_id
                INNER JOIN _***ARANGO_USERNAME***s ***ARANGO_USERNAME*** ON ***ARANGO_USERNAME***.file_id = file.id
                INNER JOIN projects project ON project.id = ***ARANGO_USERNAME***.project_id
                LEFT JOIN projects_collaborator_role pcr ON pcr.projects_id = project.id
                LEFT JOIN app_role on pcr.app_role_id = app_role.id
                LEFT JOIN appuser role_user on pcr.appuser_id = role_user.id
                WHERE
                    (
                        url ~ :url_1
                        OR url ~ :url_2
                    )
                    AND (
                        file.public = true OR (
                            app_role.name IN ('project-read', 'project-write', 'project-admin')
                            AND role_user.id = :user_id
                        )
                    )
            """

            count_query = base_query.format(select='COUNT(*) AS count')
            query = f"""
                {base_query.format(select='file.id')}
                LIMIT {int(limit)} OFFSET {int(offset)}
            """

            params = {
                'url_1': f'/projects/(?:[^/]+)/[^/]+/{re.escape(hash_id)}(?:#.*)?',
                'url_2': f'/dt/pdf/{re.escape(hash_id)}(?:#.*)?',
                'user_id': g.current_user.id,
            }
            results = db.session.execute(query, params).fetchall()

            total = len(results)
            files = self.get_nondeleted_recycled_files(Files.id.in_([row[0] for row in results]))
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
    decorators = [auth.login_required]

    def get(self, hash_id: str):
        """Fetch a single file."""
        current_user = g.current_user
        return self.get_file_response(hash_id, current_user)

    @use_args(lambda request: FileUpdateRequestSchema(partial=True),
              locations=['json', 'form', 'files', 'mixed_form_json'])
    def patch(self, params: dict, hash_id: str):
        """Update a single file."""
        current_user = g.current_user
        self.update_files([hash_id], params, current_user)
        return self.get(hash_id)


class FileContentView(FilesystemBaseView):
    decorators = [auth.login_required]

    def get(self, hash_id: str):
        """Fetch a single file's content."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)

        # Lazy loaded
        content = file.content

        if content:
            return make_cacheable_file_response(
                request,
                content.raw_file,
                etag=content.checksum_sha256.hex(),
                filename=file.filename,
                mime_type=file.mime_type
            )
        else:
            raise RecordNotFoundException('Requested object has no content')


class FileExportView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(FileExportRequestSchema)
    def post(self, params: dict, hash_id: str):
        """Export a file."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)

        if file.mime_type == 'vnd.***ARANGO_DB_NAME***.document/map':
            format = params['format']
            if format in ['png', 'svg', 'pdf']:
                content = file.content  # Lazy loaded
                exported_file = self._export_map(file, format)
                ext = f".{format}"  # TODO: Fix this extension assumption

                return make_cacheable_file_response(
                    request,
                    exported_file,
                    etag=content.checksum_sha256.hex(),
                    filename=f"{file.filename}{ext}",
                    mime_type=self.extension_mime_types[ext],
                )

        raise ValidationError("Unknown or invalid export format for the requested file.",
                              "format")

    def _export_map(self, file: Files, format: str):
        json_graph = json.loads(file.content.raw_file)
        graph_attr = [('margin', '3')]

        if format == 'png':
            graph_attr.append(('dpi', '300'))

        graph = graphviz.Digraph(
            file.filename,
            comment=file.description,
            engine='neato',
            graph_attr=graph_attr,
            format=format)

        for node in json_graph['nodes']:
            params = {
                'name': node['hash'],
                'label': node['display_name'],
                'pos': f"{node['data']['x'] / 55},{-node['data']['y'] / 55}!",
                'shape': 'box',
                'style': 'rounded',
                'color': '#2B7CE9',
                'fontcolor': ANNOTATION_STYLES_DICT.get(node['label'], {'color': 'black'})['color'],
                'fontname': 'sans-serif',
                'margin': "0.2,0.0"
            }

            if node['label'] in ['map', 'link', 'note']:
                label = node['label']
                params['image'] = f'/home/n4j/assets/{label}.png'
                params['labelloc'] = 'b'
                params['forcelabels'] = "true"
                params['imagescale'] = "both"
                params['color'] = '#ffffff00'

            if node['label'] in ['association', 'correlation', 'cause', 'effect', 'observation']:
                params['color'] = ANNOTATION_STYLES_DICT.get(
                    node['label'],
                    {'color': 'black'})['color']
                params['fillcolor'] = ANNOTATION_STYLES_DICT.get(
                    node['label'],
                    {'color': 'black'})['color']
                params['fontcolor'] = 'black'
                params['style'] = 'rounded,filled'

            if 'hyperlink' in node['data'] and node['data']['hyperlink']:
                params['href'] = node['data']['hyperlink']
            if 'source' in node['data'] and node['data']['source']:
                params['href'] = node['data']['source']

            graph.node(**params)

        for edge in json_graph['edges']:
            graph.edge(
                edge['from'],
                edge['to'],
                edge['label'],
                color='#2B7CE9'
            )

        return graph.pipe()


class FileBackupView(FilesystemBaseView):
    """Endpoint to manage 'backups' that are recorded for the user when they are editing a file
    so that they don't lose their work."""
    decorators = [auth.login_required]

    @use_args(FileBackupCreateRequestSchema, locations=['json', 'form', 'files', 'mixed_form_json'])
    def put(self, params: dict, hash_id: str):
        """Endpoint to create a backup for a file for a user."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['writable'], permit_recycled=False)

        backup = FileBackup()
        backup.file = file
        backup.raw_value = params['content_value'].read()
        backup.user = current_user
        db.session.add(backup)
        db.session.commit()

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
            file_backup_table.delete() \
                .where(and_(file_backup_table.c.file_id == file.id,
                            file_backup_table.c.user_id == current_user.id))
        )
        db.session.commit()

        return jsonify({})


class FileBackupContentView(FilesystemBaseView):
    """Endpoint to get the backup's content."""
    decorators = [auth.login_required]

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
            .order_by(desc(FileBackup.creation_date)) \
            .first()

        if backup is None:
            raise RecordNotFoundException('No backup stored for this file')

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
    decorators = [auth.login_required]

    @use_args(PaginatedRequest)
    def get(self, pagination: dict, hash_id: str):
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=False)

        query = db.session.query(FileVersion) \
            .options(raiseload('*'),
                     joinedload(FileVersion.user)) \
            .filter(FileVersion.file_id == file.id) \
            .order_by(desc(FileVersion.creation_date))

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
    decorators = [auth.login_required]

    @use_args(PaginatedRequest)
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


# Use /content for endpoints that return binary data
bp.add_url_rule('objects', view_func=FileListView.as_view('file_list'))
bp.add_url_rule('search', view_func=FileSearchView.as_view('file_search'))
bp.add_url_rule('objects/<string:hash_id>', view_func=FileDetailView.as_view('file'))
bp.add_url_rule('objects/<string:hash_id>/content', view_func=FileContentView.as_view('file_content'))
bp.add_url_rule('objects/<string:hash_id>/export', view_func=FileExportView.as_view('file_export'))
bp.add_url_rule('objects/<string:hash_id>/backup', view_func=FileBackupView.as_view('file_backup'))
bp.add_url_rule('objects/<string:hash_id>/backup/content',
                view_func=FileBackupContentView.as_view('file_backup_content'))
bp.add_url_rule('objects/<string:hash_id>/versions', view_func=FileVersionListView.as_view('file_version_list'))
bp.add_url_rule('versions/<string:hash_id>/content', view_func=FileVersionContentView.as_view('file_version_content'))
