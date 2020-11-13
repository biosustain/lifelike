import io
import json
import re
import urllib.request
from collections import defaultdict
from datetime import datetime
from typing import Optional, List, Dict
from urllib.error import URLError

from flask import Blueprint, jsonify, g, make_response, request
from flask.views import MethodView
from marshmallow import ValidationError
from pdfminer import high_level
from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import raiseload, joinedload, lazyload
from webargs.flaskparser import use_args

from neo4japp.blueprints.auth import auth
from neo4japp.database import db
from neo4japp.exceptions import RecordNotFoundException, AccessRequestRequiredError
from neo4japp.models import Projects, Files, FileContent, AppUser, FileVersion
from neo4japp.models.files_queries import add_user_permission_columns, FileHierarchy, \
    build_file_hierarchy_query
from neo4japp.schemas.common import PaginatedRequest
from neo4japp.schemas.filesystem import FileUpdateRequestSchema, FileResponse, FileResponseSchema, \
    FileCreateRequestSchema, BulkFileRequestSchema, MultipleFileResponseSchema, BulkFileUpdateRequestSchema, \
    FileListSchema, FileListRequestSchema
from neo4japp.schemas.formats.drawing_tool import validate_map_data
from neo4japp.utils.network import read_url

bp = Blueprint('filesystem', __name__, url_prefix='/filesystem')


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
        'vnd.lifelike.document/map',
        'vnd.lifelike.filesystem/directory'
    }
    extension_mime_types = {
        '.pdf': 'applicatiom/pdf',
        '.llmap': 'vnd.lifelike.document/map',
    }
    content_validators = {
        'application/pdf': lambda buffer: True,
        'vnd.lifelike.document/map': validate_map_data,
        'vnd.lifelike.filesystem/directory': lambda buffer: buffer is None,
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
                     joinedload(t_file.user))

        # Fetch permissions for the given user
        query = add_user_permission_columns(query, t_project, t_file, current_user.id)

        if lazy_load_content:
            query = query.options(lazyload(t_file.content))

        results = query.all()
        grouped_results = defaultdict(lambda: [])
        files = []

        if require_hash_ids:
            missing_hash_ids = set()

            # Check we got all the files
            if len(files) != len(require_hash_ids):
                found_hash_ids = [file.hash_id for file in files]
                missing_hash_ids.update([hash_id for hash_id in require_hash_ids
                                         if hash_id not in found_hash_ids])

            if len(missing_hash_ids):
                raise RecordNotFoundException(f"The request specified one or more file or directory "
                                              f"({', '.join(missing_hash_ids)}) that could not be found.")

        for row in results:
            grouped_results[row._asdict()['initial_id']].append(row)

        for rows in grouped_results.values():
            hierarchy = FileHierarchy(rows, t_file, t_project)
            hierarchy.calculate_properties()
            hierarchy.calculate_privileges([current_user.id])
            files.append(hierarchy.file)

        return files

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

    def update_files(self, hash_ids: List[str], params: Dict, user: AppUser):
        """
        Updates the specified files using the parameters from a validated request.

        :param hash_ids: the object hash IDs
        :param params: the parameters
        :param user: the user that is making the change
        """
        changed_fields = set()

        # Collect everything that we need to query
        target_hash_ids = set(hash_ids)
        parent_hash_id = params.get('parent_hash_id')

        query_hash_ids = hash_ids[:]
        if parent_hash_id is not None:
            query_hash_ids.append(parent_hash_id)

        if parent_hash_id in target_hash_ids:
            raise ValidationError(f'An object cannot be set as the parent of itself.',
                                  "parent_hash_id")

        # ========================================
        # Fetch and check
        # ========================================

        files = self.get_nondeleted_recycled_files(Files.hash_id.in_(query_hash_ids),
                                                   user, require_hash_ids=query_hash_ids)
        self.check_file_permissions(files, user, ['writable'], permit_recycled=False)

        target_files = [file for file in files if file.hash_id in target_hash_ids]
        parent_file = None

        # Check parent
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
            is_root_dir = (file.calculated_project.root_id == file.id)

            if 'description' in params:
                if file.description != params['description']:
                    file.description = params['description']
                    changed_fields.add('description')

            # Some changes cannot be applied to root directories
            if not is_root_dir:
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

                    # Only make a file version if the content actually changed
                    if file.content_id != new_content_id:
                        # Create file version
                        version = FileVersion()
                        version.file = file
                        version.content_id = file.content_id
                        version.user = user
                        db.session.add(version)

                        file.content_id = new_content_id

            file.modifier = user

        if len(changed_fields):
            try:
                db.session.commit()
            except IntegrityError as e:
                raise ValidationError("The requested changes would result in a duplicate filename "
                                      "within the same folder.")

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

        children = self.get_nondeleted_recycled_files(Files.parent_id == return_file.id)
        # Note: We don't check permissions here, but there are no negate permissions

        return_file.calculated_children = children

        return jsonify(FileResponseSchema(context={
            'user_privilege_filter': g.current_user.id,
        }, exclude=(
            'object.children.children',  # We aren't loading sub-children
        )).dump(FileResponse(
            object=return_file,
        )))

    def get_bulk_file_response(self, hash_ids: List[str], user: AppUser):
        """
        Fetch several files and return a response that can be sent to the client. Could
        possibly return a response with an empty list if there were no matches. Permissions
        are checked and this method will throw a relevant response exception.

        :param hash_ids: the hash IDs of the files
        :param user: the user to check permissions for
        :return: the response
        """
        files = self.get_nondeleted_recycled_files(Files.hash_id.in_(hash_ids))
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
        )))

    def detect_mime_type(self, buffer):
        try:
            json.load(buffer)
            return 'vnd.lifelike.document/map'
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


class FileListView(FilesystemBaseView):
    decorators = [auth.login_required]

    @use_args(FileListRequestSchema)
    @use_args(PaginatedRequest)
    def get(self, params: dict, pagination: dict):
        assert params['type'] == 'public'

        # TODO
        return jsonify(FileListSchema(context={
            'user_privilege_filter': g.current_user.id,
        }, exclude=(
            'results.children',
        )).dump({
            'total': 0,
            'results': [],
        }))

    @use_args(FileCreateRequestSchema, locations=['json', 'form', 'files'])
    def put(self, params: dict):
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

    @use_args(lambda request: BulkFileRequestSchema())
    @use_args(lambda request: BulkFileUpdateRequestSchema(partial=True))
    def patch(self, targets, params):
        """File update endpoint."""

        current_user = g.current_user
        self.update_files(targets['hash_ids'], params, current_user)
        return self.get_bulk_file_response(targets['hash_ids'], current_user)

    # noinspection DuplicatedCode
    @use_args(lambda request: BulkFileRequestSchema())
    def delete(self, targets):
        """File delete endpoint."""

        current_user = g.current_user

        hash_ids = targets['hash_ids']

        files = self.get_nondeleted_recycled_files(hash_ids, current_user)
        self.check_file_permissions(files, current_user, ['writable'], permit_recycled=True)

        # ========================================
        # Apply
        # ========================================

        for file in files:
            if file.calculated_project.root_id == file.id:
                raise ValidationError(f"You cannot delete the root directory "
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

        return self.get_bulk_file_response(hash_ids, current_user)

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


class FileDetailView(FilesystemBaseView):
    decorators = [auth.login_required]

    def get(self, hash_id):
        """Fetch a single file."""
        current_user = g.current_user
        return self.get_file_response(hash_id, current_user)

    @use_args(lambda request: FileUpdateRequestSchema(partial=True), locations=['json', 'form', 'files'])
    def patch(self, params, hash_id):
        """Update a single file."""
        current_user = g.current_user
        self.update_files([hash_id], params, current_user)
        return self.get(hash_id)


class FileContentView(FilesystemBaseView):
    decorators = [auth.login_required]

    def get(self, hash_id):
        """Fetch a single file's content."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)

        # Lazy loaded
        content = file.content

        if content:
            etag = content.checksum_sha256.hex()

            # Handle ETag cache response
            if request.if_none_match and etag in request.if_none_match:
                return '', 304
            else:
                response = make_response(content.raw_file)
                response.headers['Cache-Control'] = 'no-cache, max-age=0'
                response.headers['Content-Type'] = file.mime_type
                response.headers['Content-Length'] = len(content.raw_file)
                response.headers['Content-Disposition'] = f"attachment;filename={file.filename}"
                response.headers['ETag'] = f'"{etag}"'
                return response
        else:
            raise RecordNotFoundException('Requested object has no content')


class FileAnnotationsView(FilesystemBaseView):
    decorators = [auth.login_required]

    def get(self, hash_id):
        """Fetch annotations for a file.."""
        current_user = g.current_user

        file = self.get_nondeleted_recycled_file(Files.hash_id == hash_id, lazy_load_content=True)
        self.check_file_permissions([file], current_user, ['readable'], permit_recycled=True)

        if file.annotations:
            annotations = file.annotations['documents'][0]['passages'][0]['annotations']

            def terms_match(term_in_exclusion, term_in_annotation, is_case_insensitive):
                if is_case_insensitive:
                    return term_in_exclusion.lower() == term_in_annotation.lower()
                return term_in_exclusion == term_in_annotation

            # Add additional information for annotations that were excluded
            for annotation in annotations:
                for exclusion in file.excluded_annotations:
                    if (exclusion.get('type') == annotation['meta']['type'] and
                            terms_match(
                                exclusion.get('text', 'True'),
                                annotation.get('textInDocument', 'False'),
                                exclusion['isCaseInsensitive'])):
                        annotation['meta']['isExcluded'] = True
                        annotation['meta']['exclusionReason'] = exclusion['reason']
                        annotation['meta']['exclusionComment'] = exclusion['comment']
        else:
            annotations = []


bp.add_url_rule('objects', view_func=FileListView.as_view('file'))
bp.add_url_rule('objects/<string:hash_id>', view_func=FileDetailView.as_view('file_detail'))
bp.add_url_rule('objects/<string:hash_id>/content', view_func=FileContentView.as_view('file_content'))
bp.add_url_rule('objects/<string:hash_id>/annotations', view_func=FileAnnotationsView.as_view('file_annotations'))
