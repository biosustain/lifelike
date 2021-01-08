from io import BytesIO
from typing import List, Optional, Tuple

from neo4japp.models import Files
from neo4japp.services.file_types.exports import ExportFormatError, FileExport


class BaseFileTypeProvider:
    """
    A file type provider knows how to handle a certain or set of file types. Instances
    are used by the application to discover operations on files stored within Lifelike.
    """

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

    def detect_content_confidence(self, buffer: BytesIO) -> Optional[float]:
        """
        Given the byte buffer, return a confidence level indicating
        whether the file could possibly be of this file type. Larger numbers
        indicate a higher confidence and negative numbers are supported, while
        a zero indicates a neutral position. If the provided buffer is
        definitely not of this file type, None should be returned.

        This method is called when the user uploads a file from their computer and
        we need to figure out what kind of file type it is. This method does not have
        to be implemented by a file type, but that means that the user cannot upload
        those types of files (as of writing) because there's no way to select the
        file type when uploading a file (as of writing).

        :param buffer: the file buffer
        :return: a confidence level or None
        """
        return None

    def can_create(self) -> bool:
        """
        Returns whether this files of this type can be created or uploaded by the user.

        This method exists because we may implement file types that can be created by
        the system but cannot be created by the user. This method is called if the user
        uploads a file (or hacks the API to create a new copy) of this format.

        :return: true if the type can be created
        """
        return False

    def validate_content(self, buffer: BytesIO):
        """
        Validate the contents of the given buffer to see if it is correct for
        this given file type.

        You MUST validate the data if possible, especially if it's our
        own format, especially if it's JSON that we generate!

        :param buffer: the file's contents
        :raises ValueError: raised if the content is invalid
        """
        # Be sure to implement JSON validation (if applicable)!
        # See the map and enrichment table formats for examples
        raise ValueError('format cannot be validated')

    def extract_doi(self, buffer: BytesIO) -> Optional[str]:
        """
        Attempt to extract a DOI from the file.

        :param buffer: the file's contents
        :return: a DOI string or None
        """
        # In the PDF implementation as of writing, we do a regex on the file's
        # contents to look for the DOI
        return None

    def to_indexable_content(self, buffer: BytesIO):
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
        return BytesIO()

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

    def generate_export(self, file: Files, format: str) -> FileExport:
        """
        Generate an export for this file of the provided format. If the format is not
        supported, then an exception should be raised. The file.content field of the
        provided file is available and may (or may not) have been eager loaded.

        :param file: the file
        :param format: the format
        :return: an export
        :raises ExportFormatError: raised if the export is not supported
        """
        raise ExportFormatError()


class DefaultFileTypeProvider(BaseFileTypeProvider):
    """
    A generic file type provider that is returned when we don't know what
    type of file it is or we don't support it.
    """
    mime_types = ('application/octet-stream',)

    def handles(self, file: Files) -> bool:
        return True


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
        :param service: the provider
        """
        self.providers.append(provider)

    def get(self, file: Files) -> BaseFileTypeProvider:
        """
        Get the provider for the given file.
        :param file: the file
        :return: a provider, which may be the default one
        """
        for provider in self.providers:
            if provider.handles(file):
                return provider
        return self.default_provider

    def detect_type(self, buffer: BytesIO) -> BaseFileTypeProvider:
        """
        Detect the file type based on the file's contents. A provider
        will be returned regardless, although it may be the default one.
        :param buffer: the file's contents
        :return: a provider
        """
        results: List[Tuple[BaseFileTypeProvider, float]] = []
        for provider in self.providers:
            try:
                confidence = provider.detect_content_confidence(buffer)
                if confidence is not None:
                    results.append((provider, confidence))
            finally:
                buffer.seek(0)
        if len(results):
            results.sort(key=lambda item: item[1])
            return results[-1][0]
        else:
            return self.default_provider
