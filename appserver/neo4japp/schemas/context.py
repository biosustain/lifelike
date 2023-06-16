import marshmallow
from marshmallow import fields

from neo4japp.constants import MAX_CONTEXT_PARAM_LENGTH, MAX_CONTEXT_PARAMS
from neo4japp.schemas.base import CamelCaseSchema


class ContextRelationshipRequestSchema(CamelCaseSchema):
    entities = fields.List(
        fields.String(
            # validate=marshmallow.validate.Length(max=MAX_CONTEXT_PARAM_LENGTH)
        ),
        validate=marshmallow.validate.Length(min=1, max=MAX_CONTEXT_PARAMS),
        required=True,
    )
    _in = fields.String(
        validate=marshmallow.validate.Length(max=MAX_CONTEXT_PARAM_LENGTH)
    )