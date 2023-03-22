from dataclasses import dataclass, asdict
from http import HTTPStatus
from typing import Union, Optional, cast

from neo4japp.util import get_transaction_id
from neo4japp.utils.dataclass import TemplateDescriptor
from neo4japp.base_server_exception import BaseServerException


@dataclass(repr=False, frozen=True)
class HandledException(Exception):
    exception: Exception


@dataclass(repr=False, frozen=True)
class ServerException(Exception, BaseServerException):
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
    code: Union[HTTPStatus, int] = HTTPStatus.INTERNAL_SERVER_ERROR

    @property
    def type(self):
        return type(self).__name__

    @property
    def transaction_id(self):
        return get_transaction_id()

    def __str__(self):
        lines = [f'<Exception {self.transaction_id}> {self.title}: {self.message}']
        try:
            lines = lines + [f'\t{key}:\t{value}' for key, value in self.fields.items()]
        except Exception:
            pass
        return '\n'.join(lines)

    def to_dict(self):
        return asdict(self)


@dataclass(repr=False, frozen=True)
class DeleteNonEmpty(ServerException):
    pass


@dataclass(repr=False, frozen=True)
class StatisticalEnrichmentError(ServerException):
    pass


@dataclass(repr=False, frozen=True)
class AnnotationError(ServerException):
    term: Optional[str] = None
    title: str = 'Unable to Annotate'
    message: Optional[str] = cast(
        Optional[str],
        TemplateDescriptor(
            default='There was a problem annotating "$term". '
                    'Please make sure the term is correct, '
                    'including correct spacing and no extra characters.'
        )
    )

    def __post_init__(self):
        if self.message is None and not self.term:
            raise NotImplementedError("To render default Annotation error, term must be given.")


@dataclass(repr=False, frozen=True)
class LMDBError(ServerException):
    pass


@dataclass(repr=False, frozen=True)
class FileUploadError(ServerException):
    pass


@dataclass(repr=False, frozen=True)
class ContentValidationError(ServerException):
    title: str = 'Content validation error'


@dataclass(repr=False, frozen=True)
class NotAuthorized(ServerException):
    message: str = 'You do not have sufficient privileges.'
    code: Union[HTTPStatus, int] = HTTPStatus.FORBIDDEN


@dataclass(repr=False, frozen=True)
class CannotCreateNewUser(ServerException):
    title = 'Cannot Create New User'
    code: Union[HTTPStatus, int] = HTTPStatus.BAD_REQUEST


@dataclass(repr=False, frozen=True)
class CannotCreateNewProject(ServerException):
    title = 'Cannot Create New Project'
    code: Union[HTTPStatus, int] = HTTPStatus.BAD_REQUEST


@dataclass(repr=False, frozen=True)
class FailedToUpdateUser(ServerException):
    title = 'Failed to Update User'
    code: Union[HTTPStatus, int] = HTTPStatus.BAD_REQUEST


@dataclass(repr=False, frozen=True)
class RecordNotFound(ServerException):
    code: Union[HTTPStatus, int] = HTTPStatus.NOT_FOUND


@dataclass(repr=False, frozen=True)
class InvalidArgument(ServerException):
    code: Union[HTTPStatus, int] = HTTPStatus.BAD_REQUEST


@dataclass(repr=False, frozen=True)
class JWTTokenException(ServerException):
    """Signals JWT token issue"""
    code: Union[HTTPStatus, int] = HTTPStatus.UNAUTHORIZED


@dataclass(repr=False, frozen=True)
class JWTAuthTokenException(JWTTokenException):
    """Signals the JWT auth token has an issue"""
    pass


@dataclass(repr=False, frozen=True)
class FormatterException(ServerException):
    """Signals that a CamelDictMixin object was not formatted to/from
    dict correctly."""
    pass


@dataclass(repr=False, frozen=True)
class OutdatedVersionException(ServerException):
    """Signals that the client sent a request from a old version of the application."""
    code: Union[HTTPStatus, int] = HTTPStatus.NOT_ACCEPTABLE


@dataclass(repr=False, frozen=True)
class UnsupportedMediaTypeError(ServerException):
    """Signals that the client sent a request for an unsupported media type."""
    code: Union[HTTPStatus, int] = HTTPStatus.UNSUPPORTED_MEDIA_TYPE


@dataclass(repr=False, frozen=True)
class AuthenticationError(ServerException):
    """Signals that the client sent a request with invalid credentials."""
    title: str = 'Failed to Authenticate'
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


@dataclass(repr=False, frozen=True)
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
    message: Optional[str] = cast(
        Optional[str],
        TemplateDescriptor(
            default='You have "$curr_access" access. Please request "$req_access" '
                    'access at minimum for this content.'
        )
    )
    code: Union[HTTPStatus, int] = HTTPStatus.FORBIDDEN


class GDownException(Exception):
    code = 400
