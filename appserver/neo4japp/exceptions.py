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


class FormatterException(BaseException):
    """Signals that a CamelDictMixin object was not formatted to/from
    dict correctly."""
    def __init__(self, message):
        super().__init__('Formatter Error', message)