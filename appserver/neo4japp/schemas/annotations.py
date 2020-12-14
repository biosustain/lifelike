from marshmallow import fields
from marshmallow_enum import EnumField

from neo4japp.models.files import AnnotationChangeCause
from neo4japp.request_schemas.annotations import MetaSchema
from neo4japp.schemas.base import CamelCaseSchema


class AnnotationChangeExclusionMetaSchema(CamelCaseSchema):
    id = fields.String(required=True)
    idHyperlink = fields.String(required=True)
    text = fields.String(required=True)
    type = fields.String(required=True)
    reason = fields.String(required=True)
    comment = fields.String(required=True)
    excludeGlobally = fields.Boolean(required=True)
    isCaseInsensitive = fields.Boolean(required=True)


class AnnotationInclusionChangeSchema(CamelCaseSchema):
    action = fields.String()
    date = fields.DateTime()
    meta = fields.Nested(MetaSchema)


class AnnotationExclusionChangeSchema(CamelCaseSchema):
    action = fields.String()
    meta = fields.Nested(AnnotationChangeExclusionMetaSchema)


class FileAnnotationChangeSchema(CamelCaseSchema):
    date = fields.DateTime()
    cause = EnumField(AnnotationChangeCause, by_value=True)
    inclusion_changes = fields.List(fields.Nested(AnnotationInclusionChangeSchema))
    exclusion_changes = fields.List(fields.Nested(AnnotationExclusionChangeSchema))


class FileAnnotationHistoryResponseSchema(CamelCaseSchema):
    total = fields.Integer()
    results = fields.List(fields.Nested(FileAnnotationChangeSchema))
