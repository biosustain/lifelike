class ServerException(Exception):
    def __init__(self, name=None, message=None, additional_msgs=None, fields=None, code=500, *args):
        """
        Create a new exception.
        :param name: the name of the error, which sometimes used on the client
        :param message: a message that can be displayed to the user
        :param additional_msgs: a list of messages that contain more details for the user
        :param code: the error code
        :param args: extra args
        """
        if not name:
            name = 'Internal Server Error'

        if not message:
            message = 'Looks like something went wrong!'

        if not additional_msgs:
            additional_msgs = [
                'We track these errors, but if the problem persists, ' +
                'feel free to contact us with the transaction id.']
        else:
            additional_msgs += [
                'We track these errors, but if the problem persists, ' +
                'feel free to contact us with the transaction id.']

        self.name = name
        self.message = message
        self.additional_msgs = additional_msgs
        self.code = code
        self.fields = fields
        super().__init__(*args)

    @property
    def stacktrace(self):
        return self._stacktrace

    @stacktrace.setter
    def stacktrace(self, stacktrace):
        self._stacktrace = stacktrace

    @property
    def version(self):
        return self._version

    @version.setter
    def version(self, version):
        self._version = version

    @property
    def transaction_id(self):
        return self._transaction_id

    @transaction_id.setter
    def transaction_id(self, transaction_id):
        self._transaction_id = transaction_id

    def __str__(self):
        return f'<Exception> {self.name}:{self.message}'

    def to_dict(self):
        retval = {}
        retval['name'] = self.name
        retval['message'] = self.message
        return retval


class AnnotationError(ServerException):
    """An error occured during the annotation process"""

    def __init__(self, message=None, additional_msgs=[], code=500) -> None:
        super().__init__('Annotation Error', message, additional_msgs, code)


class LMDBError(ServerException):
    """An error occured during the LMDB process"""

    def __init__(self, message=None, additional_msgs=[], code=500) -> None:
        super().__init__('LMDB Error', message, additional_msgs, code)


class FileUploadError(ServerException):
    """An error occured during the file upload process"""

    def __init__(self, message=None, additional_msgs=[], code=500) -> None:
        super().__init__('File Upload Error', message, additional_msgs, code)


class DatabaseError(ServerException):
    """An error occured in database operation"""

    def __init__(self, message=None, additional_msgs=[], code=500) -> None:
        super().__init__('Database Error', message, additional_msgs, code)


class DirectoryError(ServerException):
    """An error occured in directory operation"""

    def __init__(self, message=None, additional_msgs=[], code=500) -> None:
        super().__init__('Directory Error', message, additional_msgs, code)


class DuplicateRecord(ServerException):
    def __init__(self, message=None, additional_msgs=[], code=500):
        super().__init__('Duplicate Error', message, additional_msgs, code)


class InvalidArgumentsException(ServerException):
    """A generic error occurred with invalid API arguments."""
    def __init__(self, message=None, additional_msgs=[], fields=None, code=400):
        super().__init__('Argument Error', message, additional_msgs, fields, code)


class InvalidFileNameException(ServerException):
    """Signals invalid filename"""

    def __init__(self, message=None, additional_msgs=[], code=500):
        super().__init__('File Name Error', message, additional_msgs, code)


class InvalidDirectoryNameException(ServerException):
    """Signals invalid directory name"""

    def __init__(self, message=None, additional_msgs=[], code=500):
        super().__init__('Directory Name Error', message, additional_msgs, code)


class KgImportException(ServerException):
    """Signals something went wrong during import into the knowledge graph"""

    def __init__(self, message=None, additional_msgs=[], code=500):
        super().__init__('Knowledge Graph Import Error', message, additional_msgs, code)


class NotAuthorizedException(ServerException):
    """Signals that the client does not sufficient privilege"""

    def __init__(self, message=None, additional_msgs=[], code=400):
        super().__init__('Authorization Error', message, additional_msgs, code)


class RecordNotFoundException(ServerException):
    """Signals that no record is found in the database"""

    def __init__(self, message=None, additional_msgs=[], code=404):
        super().__init__('No Data Error', message, additional_msgs, code)


class JWTTokenException(ServerException):
    """Signals JWT token issue"""

    def __init__(self, message=None, additional_msgs=[], code=500):
        super().__init__('JWT Token Error', message, additional_msgs, code)


class JWTAuthTokenException(JWTTokenException):
    """Signals the JWT auth token has an issue"""

    def __init__(self, message=None, additional_msgs=[], code=401):
        super().__init__('JWT Token Error', message, additional_msgs, code)


class FormatterException(ServerException):
    """Signals that a CamelDictMixin object was not formatted to/from
    dict correctly."""

    def __init__(self, message=None, additional_msgs=[], code=401):
        super().__init__('Serializing Error', message, additional_msgs, code)


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


class AccessRequestRequiredError(ServerException):
    """
    Raised when access needs to be requested for a project. The end goal is to
    provide enough data in this error to the client that we can pop up a
    dialog to allow the user to request permission. As of writing, this error has not been
    fleshed out and will probably need rethinking.

    On the client, this error just shows a generic permission error.

    We may want to merge this exception with FilesystemAccessRequestRequired.
    """
    def __init__(self, curr_access, req_access, hash_id, additional_msgs=[], code=403):
        message = f'You have {curr_access} access but not {req_access} access to <{hash_id}>.'
        super().__init__('Access Error', message, additional_msgs, code)
