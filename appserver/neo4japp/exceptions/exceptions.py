from dataclasses import dataclass, asdict, MISSING, field
from http import HTTPStatus
from typing import Union, Tuple, Optional, TypeVar, Generic

from neo4japp.utils.globals import transaction_id
from neo4japp.utils.dataclass import TemplateDescriptor
from neo4japp.base_server_exception import BaseServerException

T = TypeVar('T')


class CauseDefaultingDescriptor(Generic[T]):
    _default: T
    _prefix: str

    def __init__(self, default: T = MISSING, prefix: str = '_'):  # type: ignore
        self._default = default
        self._prefix = prefix

    def __set_name__(self, owner, name):
        self._name = name

    @property
    def _prefixed_name(self):
        return self._prefix + self._name

    def __get__(self, instance, owner):
        set_value = getattr(instance, self._prefixed_name, MISSING)
        if set_value is not MISSING:
            return set_value
        cause = getattr(instance, '__cause__', MISSING)
        if cause is not MISSING:
            cause_value = getattr(cause, self._name, MISSING)
            if cause_value is not MISSING:
                return cause_value
        return self._default

    def __set__(self, instance, value):
        if value is not self:
            setattr(instance, self._prefixed_name, value)

    def __repr__(self):
        return f'<{type(self).__name__} {self._name}>'


def cause_field(
        *, default=MISSING, default_factory=MISSING, **kwargs
):
    """
    Convinience function which inits dataclass field with defaults created based on
    exception __cause__
    :param default: same as for dataclass.field
    :param default_factory: same as for dataclass.field
    :param kwargs: same as for dataclass.field
    :return:
    """
    return field(
        default=CauseDefaultingDescriptor(default) if default is not MISSING else MISSING,
        default_factory=(lambda: CauseDefaultingDescriptor(
            default_factory()
        )) if default_factory is not MISSING else MISSING,
        **kwargs
    )


@dataclass(repr=False, eq=False, frozen=True)
class HandledException(Exception):
    exception: Exception


@dataclass(repr=False, eq=False, frozen=True)
class ServerException(Exception, BaseServerException):
    """
    Create a new exception.
    :param title: the title of the error, which sometimes used on the client
    :param message: a message that can be displayed to the user
    :param additional_msgs: a list of messages that contain more details for the user
    :param code: the error code
    :param fields:
    """
    title: str = cause_field(default="We're sorry!")
    message: Optional[str] = cause_field(default="Looks like something went wrong!")
    additional_msgs: Tuple[str, ...] = cause_field(default=tuple())
    fields: Optional[dict] = cause_field(default=None)
    code: HTTPStatus = cause_field(default=HTTPStatus.INTERNAL_SERVER_ERROR)
    cause: Exception = field(init=False, default=None)

    @property
    def type(self):
        return type(self).__name__

    @property
    def transaction_id(self):
        return transaction_id

    def __repr__(self):
        return f'<{self.type} {self.transaction_id}>\t{self.title}:\t{self.message}'

    def __str__(self):
        lines = [self.__repr__()]
        try:
            lines += [f'\t{key}:\t{value}' for key, value in self.fields.items()]
        except Exception:
            pass
        return '\n'.join(lines)

    def to_dict(self):
        return asdict(self)


@dataclass(repr=False, eq=False, frozen=True)
class DeleteNonEmpty(ServerException):
    pass


@dataclass(repr=False, eq=False, frozen=True)
class StatisticalEnrichmentError(ServerException):
    pass


@dataclass(repr=False, eq=False, frozen=True)
class AnnotationError(ServerException):
    term: Optional[str] = None
    title: str = 'Unable to Annotate'
    message = TemplateDescriptor(  # type: ignore
        default='There was a problem annotating "$term". '
                'Please make sure the term is correct, '
                'including correct spacing and no extra characters.'
    )

    def __post_init__(self):
        if self.message is None and not self.term:
            raise NotImplementedError("To render default Annotation error, term must be given.")


@dataclass(repr=False, eq=False, frozen=True)
class LMDBError(ServerException):
    pass


@dataclass(repr=False, eq=False, frozen=True)
class FileUploadError(ServerException):
    pass

@dataclass(repr=False, eq=False, frozen=True)
class ContentValidationError(ServerException):
    title: str = 'Content validation error'


@dataclass(repr=False, eq=False, frozen=True)
class NotAuthorized(ServerException):
    message: str = 'You do not have sufficient privileges.'
    code: HTTPStatus = HTTPStatus.FORBIDDEN


@dataclass(repr=False, eq=False, frozen=True)
class CannotCreateNewUser(ServerException):
    title: str = 'Cannot Create New User'
    code: Union[HTTPStatus, int] = HTTPStatus.BAD_REQUEST


@dataclass(repr=False, eq=False, frozen=True)
class CannotCreateNewProject(ServerException):
    title: str = 'Cannot Create New Project'
    code: Union[HTTPStatus, int] = HTTPStatus.BAD_REQUEST


@dataclass(repr=False, eq=False, frozen=True)
class FailedToUpdateUser(ServerException):
    title: str = 'Failed to Update User'
    code: Union[HTTPStatus, int] = HTTPStatus.BAD_REQUEST


@dataclass(repr=False, eq=False, frozen=True)
class RecordNotFound(ServerException):
    code: HTTPStatus = HTTPStatus.NOT_FOUND


@dataclass(repr=False, eq=False, frozen=True)
class UserNotFound(RecordNotFound):
    title: str = 'User Not Found'
    message: str = 'The requested user could not be found.'


@dataclass(repr=False, eq=False, frozen=True)
class FileNotFound(RecordNotFound):
    title: str = 'File Not Found'
    message: str = 'The requested file object could not be found.'


@dataclass(repr=False, eq=False, frozen=True)
class InvalidArgument(ServerException):
    code: HTTPStatus = HTTPStatus.BAD_REQUEST


@dataclass(repr=False, eq=False, frozen=True)
class JWTTokenException(ServerException):
    """Signals JWT token issue"""
    code: HTTPStatus = HTTPStatus.UNAUTHORIZED


@dataclass(repr=False, eq=False, frozen=True)
class JWTAuthTokenException(JWTTokenException):
    """Signals the JWT auth token has an issue"""
    pass


@dataclass(repr=False, eq=False, frozen=True)
class FormatterException(ServerException):
    """Signals that a CamelDictMixin object was not formatted to/from
    dict correctly."""
    pass


@dataclass(repr=False, eq=False, frozen=True)
class OutdatedVersionException(ServerException):
    """Signals that the client sent a request from a old version of the application."""
    code: HTTPStatus = HTTPStatus.NOT_ACCEPTABLE


@dataclass(repr=False, eq=False, frozen=True)
class UnsupportedMediaTypeError(ServerException):
    """Signals that the client sent a request for an unsupported media type."""
    code: HTTPStatus = HTTPStatus.UNSUPPORTED_MEDIA_TYPE


@dataclass(repr=False, eq=False, frozen=True)
class AuthenticationError(ServerException):
    """Signals that the client sent a request with invalid credentials."""
    title: str = 'Failed to Authenticate'
    code: HTTPStatus = HTTPStatus.UNAUTHORIZED


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


@dataclass(repr=False, eq=False, frozen=True)
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
    message = TemplateDescriptor(  # type: ignore
        default='You have "$curr_access" access. Please request "$req_access" '
                'access at minimum for this content.'
    )
    code: Union[HTTPStatus, int] = HTTPStatus.FORBIDDEN


class GDownException(Exception):
    code: HTTPStatus = HTTPStatus.BAD_REQUEST


__all__ = [
    "HandledException",
    "ServerException",
    "DeleteNonEmpty",
    "StatisticalEnrichmentError",
    "AnnotationError",
    "ContentValidationError",
    "NotAuthorized",
    "FailedToUpdateUser",
    "RecordNotFound",
    "UserNotFound",
    "FileNotFound",
    "InvalidArgument",
    "JWTTokenException",
    "JWTAuthTokenException",
    "FormatterException",
    "OutdatedVersionException",
    "UnsupportedMediaTypeError",
    "AuthenticationError",
    # "FilesystemAccessRequestRequired",
    "AccessRequestRequiredError",
    "GDownException",
]
