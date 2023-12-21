from enum import IntEnum, unique
from itertools import chain
from os import path
from typing import Dict, List, Optional, Tuple, Union, Iterator, Set, cast

import magic
from flask import g

from neo4japp.constants import FILE_MIME_TYPE_DIRECTORY
from neo4japp.database import db
from neo4japp.exceptions import ServerWarning
from neo4japp.models.files import Files
from neo4japp.services.file_types.data_exchange import DataExchange
from neo4japp.services.file_types.exports import ExportFormatError, FileExport
from neo4japp.utils.file_content_buffer import FileContentBuffer
from neo4japp.utils.globals import warn


@unique
class Certanity(IntEnum):
    """Helper enum to asess result certanity in meaningfull way
    We could simply use int of float, yet having named scale in form of enum
    should provide better overview.

    The higher the number the more certain we are about given result
    """

    default = -100
    assumed = -1
    match = 0


class BaseFileTypeProvider:
    """
    A file type provider knows how to handle a certain or set of file types. Instances
    are used by the application to discover operations on files stored within Lifelike.
    """

    # This string should be used anytime we need a user-readable representation of the
    # corresponding file type. E.g. as an option in search params.
    SHORTHAND = 'base'

    # The first entry in the mime_types tuple is the "canonical" mime type that will
    # typically be used when storing the file in the database. Make sure all entries
    # in this list are lowercase
    mime_types = ('application/octet-stream',)

    def handles(self, file: Files) -> bool:
        """
        Test whether this provider is for the given type of file.
        Most implementations should just compare the file's mime type and generally you
        should not override this method.
        :param file: the file
        :return: whether this provide should be used
        """
        return file.mime_type.lower() in self.mime_types

    def detect_provider(
        self, mime_type: str
    ) -> List[Tuple[Certanity, 'BaseFileTypeProvider']]:
        """
        Given the file, return a list of possible providers with confidence levels.
        Larger numbers indicate a higher confidence and negative
        numbers are supported, while a zero indicates a neutral position.

        Most implementations should just compare the file's mime type and generally you
        should not override this method.

        :param mime_type: the mime type
        :return: whether this provide should be used
        """
        return [(Certanity.match, self)] if mime_type.lower() in self.mime_types else []

    def convert(self, buffer):
        raise buffer

    def detect_mime_type(
        self, buffer: FileContentBuffer, extension: str = None
    ) -> List[Tuple[Certanity, str]]:
        """
        Given the byte buffer, return a list of possible mime types with
        confidence levels. Larger numbers indicate a higher confidence and negative
        numbers are supported, while a zero indicates a neutral position.

        This method is called when the user uploads a file from their computer and
        we need to figure out what kind of file type it is. This method does not have
        to be implemented by a file type, but that means that the user cannot upload
        those types of files (as of writing) because there's no way to select the
        file type when uploading a file (as of writing).

        :param buffer: the file buffer
        :param extension: the file extension
        :return: a list of mime types and their confidence levels
        """
        return []

    def can_create(self) -> bool:
        """
        Returns whether this files of this type can be created or uploaded by the user.

        This method exists because we may implement file types that can be created by
        the system but cannot be created by the user. This method is called if the user
        uploads a file (or hacks the API to create a new copy) of this format.

        :return: true if the type can be created
        """
        return False

    def validate_content(self, buffer: FileContentBuffer, log_status_messages=True):
        """
        Validate the contents of the given buffer to see if it is correct for
        this given file type.

        You MUST validate the data if possible, especially if it's our
        own format, especially if it's JSON that we generate!

        :param log_status_messages:
        :param buffer: the file's contents
        :raises ValueError: raised if the content is invalid
        """
        # Be sure to implement JSON validation (if applicable)!
        # See the map and enrichment table formats for examples
        raise ValueError('format cannot be validated')

    def extract_doi(self, buffer: FileContentBuffer) -> Optional[str]:
        """
        Attempt to extract a DOI from the file.

        :param buffer: the file's contents
        :return: a DOI string or None
        """
        # In the PDF implementation as of writing, we do a regex on the file's
        # contents to look for the DOI
        return None

    def load(self, buffer: FileContentBuffer, file: Files) -> None:
        """
        Hook to load the contents - we might want to use the contents directly
         instead of saving it to the database.
        Example use case would be to load dump files directly into the database.

        :param buffer: the file's contents
        :param file: the file construct
        """

    def to_indexable_content(self, buffer: FileContentBuffer) -> FileContentBuffer:
        """
        Return a new buffer that is suited for indexing by Elasticsearch. For
        some file formats, this operation may return a whole different type of file
        with just the keywords that need to be indexed from the original. By default,
        this method returns an empty byte buffer.

        :param buffer: the file's contents
        :return: a new file to be indexed
        """
        # Files of this file type cannot be indexed until you override this method
        # You can actually just return a blob of text (encoded in UTF-8)
        # with all the relevant keywords
        return FileContentBuffer()

    def should_highlight_content_text_matches(self) -> bool:
        """
        Return whether the 'highlight terms' returned from Elasticsearch should be shown
        to the user. For some formats, we may give Elasticsearch a file that can be indexed
        by Elasticsearch (in :func:`to_indexable_content()`) but may not be useful for
        display.

        :return: whether highlights should be shown
        """
        # If to_indexable_content() returns something like JSON, return False here because
        # the highlights will look like garbage to the user
        return False

    def generate_export(self, target_file: Files, format_: str) -> FileExport:
        """
        Generate an export for this file of the provided format. If the format is not
        supported, then an exception should be raised. The file.content field of the
        provided file is available and may (or may not) have been eager loaded.

        :param target_file: the file
        :param format_: the format
        :return: an export
        :raises ExportFormatError: raised if the export is not supported
        """
        raise ExportFormatError()

    def generate_linked_export(self, target_file: Files, format_: str) -> FileExport:
        """
        Generate an export for this file of the provided format. If the format is not
        supported, then an exception should be raised. The file.content field of the
        provided file is available and may (or may not) have been eager loaded.

        :param target_file: the file
        :param format_: the format
        :return: an export
        :raises ExportFormatError: raised if the export is not supported
        """
        if format_ != 'zip':
            raise ExportFormatError(
                "Unknown or invalid export format for the requested file."
            )

        # To prevent leaking changes to the database, we use a savepoint
        savepoint = db.session.begin_nested()

        try:
            related = set(
                cast(List[Files], self.get_related_files(target_file, recursive=set()))
            )
            if target_file.mime_type != FILE_MIME_TYPE_DIRECTORY:
                related.add(target_file)

            # Flattern inbetween folders to preserve file hierarhy in export
            # (generate_export() exports only files in the list)
            common_path_len = len(
                path.commonpath([path.dirname(f.path) for f in related])
                if len(related)
                else ''
            )

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
                current_user = g.current_user
                if _related_file.calculated_privileges[current_user.id].readable:
                    return True

                warn(
                    ServerWarning(
                        title='Skipped non-readable file',
                        message=f'User {current_user.username} has sufficient permissions'
                        f' to read "{_related_file.path}".',
                    )
                )

            permited_files = list(filter(has_read_permission, related))  # type: ignore

            # Rename project root folder to project name
            for file in permited_files:
                if file.filename == '/':
                    file.filename = file.project.name

            filename = (
                target_file.filename
                if target_file.filename != '/'
                else target_file.project.name
            ) + '.dump'

            return DataExchange.generate_export(filename, permited_files, format_)
        finally:
            savepoint.rollback()

    def prepare_content(self, buffer: FileContentBuffer, params: dict, file: Files):
        """
        Create a content to store from request data. Return unmodified if the content does not
        require additional processing (currently, only maps do).
        """
        return buffer

    def handle_content_update(self, file: Files):
        """
        Do something after a file content update.

        :param file: the file
        """

    def get_related_files(
        self, file: Files, recursive: Optional[Set[str]]
    ) -> Iterator[Union[Files, str]]:
        """
        Return a list of files linked to the given file.
        """
        if recursive:
            recursive.add(file.hash_id)
        return iter([])

    def relink_file(self, file: Files, files_hash_map) -> None:
        """
        Relink the file refs based on provided map.
        """


class GenericFileTypeProvider(BaseFileTypeProvider):
    """
    A generic file type provider that handles all miscellaneous types of files.
    """

    def __init__(self, mime_type='application/octet-stream'):
        self.mime_type = mime_type
        self.mime_types = (mime_type,)

    def detect_provider(
        self, mime_type: str
    ) -> List[Tuple[Certanity, 'BaseFileTypeProvider']]:
        return [(Certanity.default, GenericFileTypeProvider(mime_type))]

    def detect_mime_type(
        self, buffer: FileContentBuffer, extension: str = None
    ) -> List[Tuple[Certanity, str]]:
        with buffer as bufferView:
            mime_type = magic.from_buffer(bufferView.read(2048), mime=True)
            return [(Certanity.default, mime_type)]

    def validate_content(self, buffer: FileContentBuffer, log_status_messages=True):
        return

    def can_create(self) -> bool:
        return True

    def to_indexable_content(self, buffer: FileContentBuffer):
        if self.mime_type.startswith('text/'):
            return buffer  # Have Elasticsearch index these files
        else:
            return FileContentBuffer()

    def should_highlight_content_text_matches(self) -> bool:
        if self.mime_type.startswith('text/'):
            return True
        else:
            return False

    def convert(self, buffer):
        return buffer


class DefaultFileTypeProvider(BaseFileTypeProvider):
    """
    A fallback file type provider that is returned when we don't know what
    type of file it is or we don't support it.
    """

    mime_types = ('application/octet-stream',)


class FileTypeService:
    """
    The file type service returns file type providers for given files. It supports detection
    of file formats based on content as well.
    """

    providers: List[BaseFileTypeProvider]
    default_provider = DefaultFileTypeProvider()

    def __init__(self):
        self.providers = []

    def register(self, provider: BaseFileTypeProvider):
        """
        Register a new file type provider.
        :param provider: the provider
        """
        self.providers.append(provider)

    def get(self, mime_type: str) -> BaseFileTypeProvider:
        """
        Get the provider for the given mime type.
        :param mime_type: the mime_type
        :return: a provider, which may be the default one
        """
        results: List[Tuple[Certanity, BaseFileTypeProvider]] = []
        for provider in self.providers:
            results.extend(provider.detect_provider(mime_type))
        if len(results):
            results.sort(key=lambda item: item[0])
            return results[-1][1]
        return self.default_provider

    def detect_mime_type(self, buffer: FileContentBuffer, extension: str = None) -> str:
        """
        Detect the file type based on the file's contents. A provider
        will be returned regardless, although it may be the default one.
        :param buffer: the file's contents
        :param extension: the file's extension
        :return: a provider
        """
        results: List[Tuple[Certanity, str]] = []
        for provider in self.providers:
            # Note that each provider sets the same priority value for each mime_type, so the
            # priority is in the order the providers are registered. This is not ideal, we
            # should explicitly set the priority.
            results.extend(provider.detect_mime_type(buffer, extension))
        if len(results):
            results.sort(key=lambda item: item[0])
            return results[-1][1]
        else:
            return 'application/octet-stream'

    def get_shorthand_to_mime_type_map(self) -> Dict[str, str]:
        d = {}
        for provider in self.providers:
            d[provider.SHORTHAND] = provider.mime_types[0]
        return d

    def get_mime_type_to_shorthand_map(self) -> Dict[str, str]:
        d = {}
        for provider in self.providers:
            d[provider.mime_types[0]] = provider.SHORTHAND
        return d

    def relink_file(self, file: Files, files_hash_map) -> None:
        """
        Relink the file refs based on provided map.
        """
        self.get(file.mime_type).relink_file(file, files_hash_map)

    def get_related_files(self, files: List[Files], recursive: Optional[Set[str]]):
        def get_related_files(f: Files):
            return self.get(f.mime_type).get_related_files(f, recursive)

        return chain(files, *map(get_related_files, files))
