from io import BytesIO
from typing import List, Optional, Tuple

from neo4japp.models import Files
from neo4japp.services.file_types.exports import ExportFormatError, FileExport


class BaseFileTypeProvider:
    """
    A file type provider knows how to handle a certain or set of file types. Instances
    are used by the application to discover operations on files stored within Lifelike.
    """
    mime_types = ('application/octet-stream',)

    def handles(self, file: Files) -> bool:
        """
        Test whether this provider is for the given type of file.
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
        :param buffer: the file buffer
        :return: a confidence level or None
        """
        return None

    def can_create(self) -> bool:
        """
        Returns whether this files of this type can be created or uploaded by the user.
        :return: true if the type can be created
        """
        return False

    def validate_content(self, buffer: BytesIO):
        """
        Validate the contents of the given buffer to see if it is correct for
        this given file type.
        :param buffer: the file's contents
        :raises ValueError: raised if the content is invalid
        """
        raise NotImplementedError()

    def extract_doi(self, buffer: BytesIO) -> Optional[str]:
        """
        Attempt to extract a DOI from the file.
        :param buffer: the file's contents
        :return: a DOI string or None
        """
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
        return BytesIO()

    def should_highlight_content_text_matches(self) -> bool:
        """
        Return whether the 'highlight terms' returned from Elasticsearch should be shown
        to the user. For some formats, we may give Elasticsearch a file that can be indexed
        by Elasticsearch (in :func:`to_indexable_content()`) but may not be useful for
        display.
        :return:
        """
        return False

    def generate_export(self, file: Files, format: str) -> FileExport:
        """
        Generate an export for this file of the provided format. If the format is not
        supported, then an exception should be raised. The .content field of the
        provided file is available.
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
