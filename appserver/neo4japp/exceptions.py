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
