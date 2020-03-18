class BaseException(Exception):
    def __init__(self, name, message, *args):
        self.name = name
        self.message = message
        super().__init__(*args)

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


class NotAuthorizedException(BaseException):
    """Signals that the client does not sufficient privilege"""
    def __init__(self, message, additional_msgs=[]):
        super().__init__('Unauthorized Action', message, additional_msgs)


class FormatterException(BaseException):
    """Signals that a CamelDictMixin object was not formatted to/from
    dict correctly."""
    def __init__(self, message):
        super().__init__('Formatter Error', message)
