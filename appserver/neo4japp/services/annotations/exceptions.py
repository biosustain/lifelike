from dataclasses import dataclass
from http import HTTPStatus

from neo4japp.exceptions import AnnotationError

from .constants import MAX_ENTITY_WORD_LENGTH, MAX_GENE_WORD_LENGTH, MAX_FOOD_WORD_LENGTH


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
