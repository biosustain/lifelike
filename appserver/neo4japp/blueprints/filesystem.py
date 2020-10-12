import io
import json
import os
import re
import urllib.request
from collections import defaultdict
from datetime import datetime
from typing import Optional, List, Set
from urllib.error import URLError

from flask import Blueprint, jsonify, g, make_response, request
from flask.views import MethodView
from marshmallow import ValidationError
from pdfminer import high_level
from sqlalchemy import and_, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import raiseload, joinedload, lazyload
from webargs.flaskparser import use_args
from werkzeug.datastructures import FileStorage

from neo4japp.blueprints.auth import auth
from neo4japp.database import db
from neo4japp.exceptions import RecordNotFoundException, AccessRequestRequiredError
from neo4japp.models import Projects, Files, FileContent, AppUser
from neo4japp.models.files_queries import add_user_permission_columns, FileHierarchy, \
    build_file_hierarchy_query, build_file_parents_cte
from neo4japp.schemas.filesystem import FileUpdateRequestSchema, FileResponse, FileResponseSchema, \
    FileCreateRequestSchema, BulkFileRequestSchema, MultipleFileResponseSchema
from neo4japp.utils.network import read_url

bp = Blueprint('filesystem', __name__, url_prefix='/filesystem')


class FilesystemView(MethodView):
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
        '.pdf': 'applicatiom/pdf',
        '.llmap': 'vnd.***ARANGO_DB_NAME***.document/map',
    }
    content_validators = {
        'applicatiom/pdf': lambda buffer: True,
        'vnd.***ARANGO_DB_NAME***.document/map': lambda buffer: buffer is not None and json.loads(buffer.getvalue()),
        'vnd.***ARANGO_DB_NAME***.filesystem/directory': lambda buffer: buffer is None,
    }

    def get_file(self, filter, lazy_load_content=False) -> Files:
        files = self.get_files(filter, lazy_load_content)
        if not len(files):
            raise RecordNotFoundException("The requested file object could not be found.")
        return files[0]

    def get_files(self, filter, lazy_load_content=False) -> List[Files]:
        current_user = g.current_user

        t_file = db.aliased(Files, name='_file')  # alias required for the FileHierarchy class
        t_project = db.aliased(Projects, name='_project')

        query = build_file_hierarchy_query(filter, t_project, t_file) \
            .options(raiseload('*'),
                     joinedload(t_file.user))

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

        return files

    def detect_mime_type(self, params: dict):
        name, ext = os.path.splitext(params['filename'])
        mime_type = params.get('mime_type')
        if mime_type in self.accepted_mime_types:
            return mime_type
        elif ext in self.extension_mime_types:
            return self.extension_mime_types[ext]
        else:
            raise ValueError('Provided file is not a known type of file.')

    def validate_content(self, mime_type, buffer):
        validator = self.content_validators[mime_type]
        if not validator(buffer):
            raise ValueError()

    def extract_doi(self, mime_type, buffer):
        data = buffer.getvalue()

        if mime_type == 'application/pdf':
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


class FileListView(FilesystemView):
    decorators = [auth.login_required]

    def check_files_for_edit(self, hash_ids: List[str], user: AppUser, *,
                             permit_recycled: bool = False) -> List[Files]:

        # ========================================
        # Lock
        # ========================================

        q_hierarchy = build_file_parents_cte(and_(
            or_(*[Files.hash_id == key for key in hash_ids]),
            Files.deletion_date.is_(None),
        ))

        db.session.query(Files.id) \
            .join(q_hierarchy, q_hierarchy.c.id == Files.id) \
            .with_for_update() \
            .all()

        # ========================================
        # Query
        # ========================================

        files = self.get_files(or_(*[Files.hash_id == key for key in hash_ids]))

        # ========================================
        # Validate
        # ========================================

        missing_hash_ids = set()

        # Check we got all the files
        if len(files) != len(hash_ids):
            found_hash_ids = [file.hash_id for file in files]
            missing_hash_ids.update([hash_id for hash_id in hash_ids if hash_id not in found_hash_ids])

        # Check each file
        for file in files:
            if file.deleted or file.parent_deleted:
                missing_hash_ids.add(file.hash_id)

            if not file.calculated_privileges[user.id].writable:
                # Do not reveal the filename with the error!
                raise AccessRequestRequiredError(
                    f"You do not have access to the specified file object "
                    f"(with ID of {file.hash_id}) to change it.", file.hash_id)

            if not permit_recycled and (file.recycled or file.parent_recycled):
                raise ValidationError(f"The file or directory '{file.filename}' has been trashed and "
                                      "must be restored first.")

        if len(missing_hash_ids):
            raise RecordNotFoundException(f"The request specified one or more file or directory "
                                          f"({', '.join(missing_hash_ids)}) that could not be found.")

        return files

    def get_bulk_file_response(self, hash_ids: List[str], user: AppUser):
        files = self.get_files(Files.hash_id.in_(hash_ids))
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
            parent = self.get_file(Files.hash_id == params['parent_hash_id'])
            if parent.deleted or parent.parent_deleted:
                raise RecordNotFoundException("Soft deleted")
        except RecordNotFoundException:
            raise ValidationError("The requested parent object could not be found.",
                                  "parent_hash_id")

        if parent.recycled or parent.parent_recycled:
            raise ValidationError("The specified parent is in the trash and must be restored first.",
                                  "parent_hash_id")

        if not parent.calculated_privileges[current_user.id].writable:
            raise ValidationError("You do not have access to the parent object "
                                  "to add a new object to it.", "parent_hash_id")

        if parent.mime_type != Files.DIRECTORY_MIME_TYPE:
            raise ValidationError("The parent must be a directory type.", "parent_hash_id")

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
                existing_file = self.get_file(Files.hash_id == source_hash_id)
            except RecordNotFoundException:
                raise ValidationError(f"The requested file or directory to clone from "
                                      f"({source_hash_id}) could not be found.",
                                      "content_hash_id")

            if not existing_file.calculated_privileges[current_user.id].readable:
                # Make sure to not reveal the filename
                raise ValidationError(f"You do not have access to the file or folder ({source_hash_id})"
                                      f" that you are cloning.", "content_hash_id")

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
            buffer = None
            content_field = None

            # Fetch from URL
            if params.get('content_url') is not None:
                content_field = 'content_url'
                url: str = params.get('content_url')

                try:
                    buffer = read_url(urllib.request.Request(url, headers={
                        'User-Agent': self.url_fetch_user_agent,
                    }), max_length=self.file_max_size, timeout=self.url_fetch_timeout)
                except (ValueError, URLError):
                    raise ValidationError('Your file could not be downloaded, either because it is '
                                          'inaccessible or another problem occurred. Please double '
                                          'check the spelling of the URL.', "content_url")

                file.upload_url = url

            # Fetch from upload
            elif params.get('content_value') is not None:
                content_field = 'content_value'
                file_storage = params.get('content_value')

                file_storage.seek(0, 2)
                size = file_storage.tell()

                if size > self.file_max_size:
                    raise ValidationError('Your file could not be processed because it is too large.',
                                          "content_value")

                file_storage.seek(0)

                buffer = file_storage

            try:
                file.mime_type = self.detect_mime_type(params)
            except ValueError as e:
                raise ValidationError("The type of file could not be detected.", content_field)

            try:
                self.validate_content(file.mime_type, buffer)
            except ValueError as e:
                raise ValidationError("The provided file may be corrupt.", content_field)

            # Directories don't have content
            if buffer is not None:
                file.doi = self.extract_doi(file.mime_type, buffer)
                file.content_id = FileContent.get_or_create(buffer)

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
            except IntegrityError:
                db.session.rollback()

        db.session.commit()

        # ========================================
        # Return new file
        # ========================================

        # Re-fetch data just in case
        return_file = self.get_file(Files.hash_id == file.hash_id)

        if not return_file.calculated_privileges[current_user.id].readable:
            raise AccessRequestRequiredError(
                "You do not have access to this object to read it.", file.hash_id)

        children = self.get_files(Files.parent_id == file.id)
        return_file.calculated_children = children

        return jsonify(FileResponseSchema(context={
            'user_privilege_filter': g.current_user.id,
        }, exclude=(
            'object.children.children',  # We aren't loading sub-children
        )).dump(FileResponse(
            object=return_file,
        )))

    @use_args(lambda request: BulkFileRequestSchema())
    @use_args(lambda request: FileUpdateRequestSchema(partial=True))
    def patch(self, targets, params):
        """File update endpoint."""

        changed_fields = set()
        current_user = g.current_user

        # Collect everything that we need to query
        target_hash_ids = set(targets['hash_ids'])
        parent_hash_id = params.get('parent_hash_id')

        query_hash_ids = targets['hash_ids'][:]
        if parent_hash_id is not None:
            query_hash_ids.append(parent_hash_id)

        if parent_hash_id in target_hash_ids:
            raise ValidationError(f'An object cannot be set as the parent of itself.',
                                  "parent_hash_id")

        # ========================================
        # Fetch and check
        # ========================================

        # This method checks permissions
        files = self.check_files_for_edit(query_hash_ids, current_user)
        target_files = [file for file in files if file.hash_id in target_hash_ids]
        parent_file = None

        # Check parent
        if parent_hash_id is not None:
            parent_file = next(filter(lambda file: file.hash_id == parent_hash_id, files), None)

            if parent_file.mime_type != Files.DIRECTORY_MIME_TYPE:
                raise ValidationError(f"The specified parent ({parent_hash_id}) is "
                                      f"not a folder. It is a file, and you cannot make files "
                                      f"become a child of another file.", "parent_hash_id")

        # ========================================
        # Apply
        # ========================================

        for target_file in target_files:
            is_***ARANGO_USERNAME***_dir = (target_file.calculated_project.***ARANGO_USERNAME***_id == target_file.id)

            if 'description' in params:
                if target_file.description != params['description']:
                    target_file.description = params['description']
                    changed_fields.add('description')

            # Some changes cannot be applied to ***ARANGO_USERNAME*** directories
            if not is_***ARANGO_USERNAME***_dir:
                if parent_hash_id is not None:
                    # Re-check referential parent
                    if target_file.id == parent_file.id:
                        raise ValidationError(f'A file or folder ({target_file.filename}) cannot be '
                                              f'set as the parent of itself.', "parent_hash_id")

                    # TODO: Check max hierarchy depth

                    # Check for circular inheritance
                    current_parent = parent_file.parent
                    while current_parent:
                        if current_parent.hash_id == target_file.hash_id:
                            raise ValidationError(f"If the parent of '{target_file.filename}' was set to "
                                                  f"'{parent_file.filename}', it would result in circular"
                                                  f"inheritance.", "parent_hash_id")
                        current_parent = current_parent.parent

                    target_file.parent = parent_file
                    changed_fields.add('parent')

                if 'filename' in params:
                    target_file.filename = params['filename']
                    changed_fields.add('filename')

                if 'public' in params:
                    if target_file.public != params['public']:
                        target_file.public = params['public']
                        changed_fields.add('public')

            target_file.modifier = current_user

        if len(changed_fields):
            try:
                db.session.commit()
            except IntegrityError as e:
                raise ValidationError("The requested changes would result in a duplicate filename "
                                      "within the same folder.")

        # ========================================
        # Return changed files
        # ========================================

        return self.get_bulk_file_response(list(target_hash_ids), current_user)

    # noinspection DuplicatedCode
    @use_args(lambda request: BulkFileRequestSchema())
    def delete(self, targets):
        """File delete endpoint."""

        current_user = g.current_user

        hash_ids = targets['hash_ids']

        # This method checks permissions
        files = self.check_files_for_edit(hash_ids, current_user, permit_recycled=True)

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

        return self.get_bulk_file_response(hash_ids, current_user)


class FileDetailView(FilesystemView):
    decorators = [auth.login_required]

    def get(self, hash_id):
        """File fetch endpoint (without content)."""

        current_user = g.current_user
        file = self.get_file(Files.hash_id == hash_id)

        if file.parent_deleted or file.deleted:
            raise RecordNotFoundException(f"The requested file or directory ({hash_id}) "
                                          f"could not be found.")

        if not file.calculated_privileges[current_user.id].readable:
            # Make sure to not reveal the filename
            raise AccessRequestRequiredError(
                f"You do not have access to the specified file or "
                f"directory ({hash_id}) to read it.", hash_id)

        # We allow returning recycled objects

        children = self.get_files(Files.parent_id == file.id)
        file.calculated_children = children

        return jsonify(FileResponseSchema(context={
            'user_privilege_filter': g.current_user.id,
        }, exclude=(
            'object.children.children',  # We aren't loading sub-children
        )).dump(FileResponse(
            object=file,
        )))


class FileContentView(FilesystemView):
    decorators = [auth.login_required]

    def get(self, hash_id):
        """File content fetch endpoint."""

        file = self.get_file(Files.hash_id == hash_id, lazy_load_content=True)

        if file.parent_deleted or file.deleted:
            raise RecordNotFoundException("The requested file object could not be found.")

        # We allow returning recycled objects

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


bp.add_url_rule('objects', view_func=FileListView.as_view('file'))
bp.add_url_rule('objects/<string:hash_id>', view_func=FileDetailView.as_view('file_detail'))
bp.add_url_rule('objects/<string:hash_id>/content', view_func=FileContentView.as_view('file_content'))
