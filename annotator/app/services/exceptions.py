from dataclasses import dataclass
from http import HTTPStatus
from typing import Optional

from ...exceptions import ServerException

from .constants import MAX_ENTITY_WORD_LENGTH, MAX_GENE_WORD_LENGTH, MAX_FOOD_WORD_LENGTH



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
class AnnotationLimitationError(AnnotationError):
    code = HTTPStatus.BAD_REQUEST
    additional_msgs = (
        f'We currently only allow up to {MAX_ENTITY_WORD_LENGTH} word(s)'
        ' in length for a term. In addition, we'
        ' have specific word limits for some entity types:',
        f'Gene: Max {MAX_GENE_WORD_LENGTH} word.',
        f'Food: Max {MAX_FOOD_WORD_LENGTH} words.'
    )


@dataclass
class LMDBError(ServerException):
    pass
