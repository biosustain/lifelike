from dataclasses import dataclass, asdict
from http import HTTPStatus
from typing import Union, Tuple, Optional


@dataclass(repr=False)
class ServerException(Exception):
    """
    Create a new exception.
    :param title: the title of the error, which sometimes used on the client
    :param message: a message that can be displayed to the user
    :param additional_msgs: a list of messages that contain more details for the user
    :param code: the error code
    :param fields:
    """
    title: str = "We're sorry!"
    message: Optional[str] = "Looks like something went wrong!"
    additional_msgs: Tuple[str, ...] = tuple()
    fields: Optional[dict] = None
    code: Union[HTTPStatus, int] = HTTPStatus.INTERNAL_SERVER_ERROR
    stacktrace: Optional[str] = None
    version: Optional[str] = None

    @property
    def type(self):
        return type(self).__name__

    def __str__(self):
        return f'<Exception> {self.title}:{self.message}'

    def to_dict(self):
        return asdict(self)


@dataclass
class DeleteNonEmpty(ServerException):
    pass


@dataclass
class StatisticalEnrichmentError(ServerException):
    pass


@dataclass
class AnnotationError(ServerException):
    term: Optional[str] = None
    title: str = 'Unable to Annotate'
    message: Optional[str] = None

    def __post_init__(self):
        if self.message is None:
            if not self.term:
                raise NotImplementedError("To render default Annotation error, term must be given.")
            self.message = \
                f'There was a problem annotating "{self.term}". ' \
                f'Please make sure the term is correct, ' \
                f'including correct spacing and no extra characters.'


@dataclass
class LMDBError(ServerException):
    pass


@dataclass
class FileUploadError(ServerException):
    pass


@dataclass
class ContentValidationError(ServerException):
    title: str = 'Content validation error'


@dataclass
class NotAuthorized(ServerException):
    code: Union[HTTPStatus, int] = HTTPStatus.FORBIDDEN


@dataclass
class RecordNotFound(ServerException):
    code: Union[HTTPStatus, int] = HTTPStatus.NOT_FOUND


@dataclass
class InvalidArgument(ServerException):
    code: Union[HTTPStatus, int] = HTTPStatus.BAD_REQUEST


@dataclass
class JWTTokenException(ServerException):
    """Signals JWT token issue"""
    code: Union[HTTPStatus, int] = HTTPStatus.UNAUTHORIZED


@dataclass
class JWTAuthTokenException(JWTTokenException):
    """Signals the JWT auth token has an issue"""
    pass


@dataclass
class FormatterException(ServerException):
    """Signals that a CamelDictMixin object was not formatted to/from
    dict correctly."""
    pass


@dataclass
class OutdatedVersionException(ServerException):
    """Signals that the client sent a request from a old version of the application."""
    code: Union[HTTPStatus, int] = HTTPStatus.NOT_ACCEPTABLE


@dataclass
class UnsupportedMediaTypeError(ServerException):
    """Signals that the client sent a request for an unsupported media type."""
    code: Union[HTTPStatus, int] = HTTPStatus.UNSUPPORTED_MEDIA_TYPE


@dataclass
class AuthenticationError(ServerException):
    """Signals that the client sent a request with invalid credentials."""
    code: Union[HTTPStatus, int] = HTTPStatus.UNAUTHORIZED


# TODO: finish this
# class FilesystemAccessRequestRequired(ServerException):
#     """
#     Raised when access needs to be requested for a file or folder. The end goal is to
#     provide enough data in this error to the client that we can pop up a
#     dialog to allow the user to request permission. As of writing, this error has not been
#     fleshed out and will probably need rethinking.

#     On the client, this error just shows a generic permission error.

#     We may want to merge this exception with AccessRequestRequiredError.
#     """

#     def __init__(self, message=None, file_hash_id):
#         super().__init__('Access Request Required Error',
#                          message,
#                          code='access_request_required',
#                          error_return_props={
#                              'request': {
#                                  'file': {
#                                      'hash_id': file_hash_id,
#                                  }
#                              }
#                          })

@dataclass
class AccessRequestRequiredError(ServerException):
    """
    Raised when access needs to be requested for a project. The end goal is to
    provide enough data in this error to the client that we can pop up a
    dialog to allow the user to request permission. As of writing, this error has not been
    fleshed out and will probably need rethinking.

    On the client, this error just shows a generic permission error.

    We may want to merge this exception with FilesystemAccessRequestRequired.
    """
    curr_access: Optional[str] = None
    req_access: Optional[str] = None
    hash_id: Optional[str] = None
    title: str = 'You need access'
    message: Optional[str] = None
    code: Union[HTTPStatus, int] = HTTPStatus.FORBIDDEN

    def __post_init__(self):
        if self.message is None:
            self.message = \
                f'You have "{self.curr_access}" access. Please request "{self.req_access}" ' \
                f'access at minimum for this content.'


class GDownException(Exception):
    code = 400
