from dataclasses import dataclass
from typing import Optional

from ..exceptions import ServerException



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
