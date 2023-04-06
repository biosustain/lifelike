from dataclasses import dataclass
from typing import Optional

class ServerException(Exception):
    def __init__(self, title=None, message=None, additional_msgs=None, fields=None, code=500, *args):  # noqa
        """
        Create a new exception.
        :param title: the title of the error, which sometimes used on the client
        :param message: a message that can be displayed to the user
        :param additional_msgs: a list of messages that contain more details for the user
        :param code: the error code
        :param fields:
        :param args: extra args
        """
        if not title:
            title = 'We\'re sorry!'

        if not message:
            message = 'Looks like something went wrong!'

        self.title = title
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
        return f'<Exception> {self.title}:{self.message}'

    def to_dict(self):
        retval = {}
        retval['title'] = self.title
        retval['message'] = self.message
        return retval


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
