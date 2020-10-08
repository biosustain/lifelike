from typing import Dict, List, Optional


class BaseException(Exception):
    def __init__(self, name, message, *args, code='error', error_return_props=None):
        self.name = name
        self.message = message
        self.code = code
        self.error_return_props = error_return_props if error_return_props is not None else {}
        super().__init__(*args)

    def __str__(self):
        return f'<Exception> {self.name}:{self.message}'

    def to_dict(self):
        retval = {}
        retval['name'] = self.name
        retval['message'] = self.message
        return retval


class AnnotationError(BaseException):
    """AN error occured during the annotation process"""

    def __init__(self, message, additional_msgs=[]) -> None:
        super().__init__('Annotation Error', message, additional_msgs)


class FileUploadError(BaseException):
    """AN error occured during the file upload process"""

    def __init__(self, message, additional_msgs=[]) -> None:
        super().__init__('File Upload Error', message, additional_msgs)


class DatabaseError(BaseException):
    """An error occured in database operation"""

    def __init__(self, message, additional_msgs=[]) -> None:
        super().__init__('Database Error', message, additional_msgs)


class DirectoryError(BaseException):
    """An error occured in directory operation"""

    def __init__(self, message, additional_msgs=[]) -> None:
        super().__init__('Directory Error', message, additional_msgs)


class DuplicateRecord(BaseException):
    def __init__(self, message, additional_msgs=[]):
        super().__init__('Duplicate record', message, additional_msgs)


class InvalidArgumentsException(BaseException):
    """A generic error occurred with invalid API arguments."""

    fields: Optional[Dict[str, List[str]]]

    def __init__(self, message: str,
                 additional_msgs: Optional[List[str]] = None,
                 fields: Optional[Dict[str, List[str]]] = None):
        """
        Construct a new instance.

        :param message: The machine-readable message
        :param additional_msgs: Additional messages
        :param fields: A dictionary of fields and their errors
        """
        super().__init__('Argument Error', message, additional_msgs or [])
        self.fields = fields or {}

    def to_dict(self):
        retval = super().to_dict()
        retval['fields'] = self.fields
        return retval


class InvalidFileNameException(BaseException):
    """Signals invalid filename"""

    def __init__(self, message, additional_msgs=[]):
        super().__init__('File has incorrect filename', message, additional_msgs)


class InvalidDirectoryNameException(BaseException):
    """Signals invalid directory name"""

    def __init__(self, message, additional_msgs=[]):
        super().__init__('Directory has incorrect directory name', message, additional_msgs)


class InvalidCredentialsException(BaseException):
    """Signals invalid credentials used"""

    def __init__(self, message, additional_msgs=[]):
        super().__init__('Invalid credentials', message, additional_msgs)


class KgImportException(BaseException):
    """Signals something went wrong during import into the knowledge graph"""

    def __init__(self, message, additional_msgs=[]):
        super().__init__('Knowledge graph import error', message, additional_msgs)


class NotAuthorizedException(BaseException):
    """Signals that the client does not sufficient privilege"""

    def __init__(self, message, additional_msgs=[]):
        super().__init__('Unauthorized Action', message, additional_msgs)


class RecordNotFoundException(BaseException):
    """Signals that no record is found in the database"""

    def __init__(self, message, additional_msgs=[]):
        super().__init__('Record not found', message)


class JWTTokenException(BaseException):
    """Signals JWT token issue"""

    def __init__(self, message, additional_msgs=[]):
        super().__init__('JWT', message)


class JWTAuthTokenException(JWTTokenException):
    """Signals the JWT auth token has an issue"""

    def __init__(self, message):
        super().__init__(message)


class FormatterException(BaseException):
    """Signals that a CamelDictMixin object was not formatted to/from
    dict correctly."""

    def __init__(self, message):
        super().__init__('Formatter Error', message)


class DataNotAvailableException(BaseException):
    """Signals that the requested data is not available in a storage."""

    def __init__(self, message):
        super().__init__('Data Not Available Error', message)


class NameUnavailableError(BaseException):
    """Raised when a name has been taken."""

    def __init__(self, message):
        super().__init__('Name Unavailable Error', message)


class FilesystemAccessRequestRequired(BaseException):
    """Raised when access needs to be requested."""

    def __init__(self, message, file_hash_id):
        super().__init__('Access Request Required Error',
                         message,
                         code='access_request_required',
                         error_return_props={
                             'request': {
                                 'file': {
                                     'hash_id': file_hash_id,
                                 }
                             }
                         })
