class BaseException(Exception):
    def __init__(self, name, message, *args):
        self.name = name
        self.message = message
        super().__init__(*args)

    def __str__(self):
        return f'<Exception> {self.name}:{self.message}'

    def to_dict(self):
        retval = {}
        retval['name'] = self.name
        retval['message'] = self.message
        return retval


class DatabaseError(BaseException):
    """An error occured in database operation"""
    def __init__(self, message, additional_msgs=[]) -> None:
        super().__init__('Database Error', message, additional_msgs)


class DuplicateRecord(BaseException):
    def __init__(self, message, additional_msgs=[]):
        super().__init__('Duplicate record', message, additional_msgs)


class InvalidCredentialsException(BaseException):
    """Signals invalid credentials used"""
    def __init__(self, message, additional_msgs=[]):
        super().__init__('Invalid credentials', message, additional_msgs)


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


class BadRequestError(BaseException):
    """Signals that the user may have done something wrong and that the
    message should be shown to the user."""
    def __init__(self, message):
        super().__init__('Bad Request Error', message)


class DataNotAvailableException(BaseException):
    """Signals that the requested data is not available in a storage."""
    def __init__(self, message):
        super().__init__('Data Not Available Error', message)
