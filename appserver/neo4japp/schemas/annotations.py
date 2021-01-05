import marshmallow.validate
from marshmallow import Schema, fields, post_load
from marshmallow_enum import EnumField

from neo4japp.models import FallbackOrganism
from neo4japp.request_schemas.annotations import LinksSchema
from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.services.annotations.constants import AnnotationMethod


class CombinedAnnotationMetaSchema(Schema):
    type = fields.String()
    color = fields.String()
    id = fields.String()
    idType = fields.String()
    idHyperlink = fields.String()
    isCustom = fields.Boolean()
    allText = fields.String()
    links = fields.Nested(LinksSchema)
    includeGlobally = fields.Boolean()
    isCaseInsensitive = fields.Boolean()
    isExcluded = fields.Boolean()
    exclusionReason = fields.String()
    exclusionComment = fields.String()


class CombinedAnnotationSchema(Schema):
    uuid = fields.String()
    pageNumber = fields.Integer()
    keywords = fields.List(fields.String())
    rects = fields.List(fields.List(fields.Float()))
    meta = fields.Nested(CombinedAnnotationMetaSchema)


class FileAnnotationsResponseSchema(CamelCaseSchema):
    annotations = fields.List(fields.Nested(CombinedAnnotationSchema))


class FallbackOrganismSchema(Schema):  # Not camel case!
    organism_name = fields.String(required=True,
                                  validate=marshmallow.validate.Length(min=1, max=200))
    synonym = fields.String(required=True,
                            validate=marshmallow.validate.Length(min=1, max=200))
    tax_id = fields.String(required=True,
                           validate=marshmallow.validate.Length(min=1, max=200))

    @post_load
    def create(self, params, **kwargs):
        return FallbackOrganism(
            organism_name=params['organism_name'],
            organism_synonym=params['synonym'],
            organism_taxonomy_id=params['tax_id']
        )


class AnnotationGenerationRequestSchema(CamelCaseSchema):
    organism = fields.Nested(FallbackOrganismSchema, allow_none=True)
    annotation_method = EnumField(AnnotationMethod, by_value=True)


class AnnotationGenerationResultSchema(CamelCaseSchema):
    attempted = fields.Boolean()
    success = fields.Boolean()


class MultipleAnnotationGenerationResponseSchema(CamelCaseSchema):
    results = fields.Dict(keys=fields.String(),
                          values=fields.Nested(AnnotationGenerationResultSchema))
    missing = fields.List(fields.String)
