from marshmallow import Schema, fields

from neo4japp.schemas.base import CamelCaseSchema


class EnrichmentValue(CamelCaseSchema):
    text = fields.String(required=True)
    annotated_text = fields.String(allow_none=True)
    link = fields.String(required=True)


class EnrichedGene(CamelCaseSchema):
    imported = fields.String(allow_none=True)
    matched = fields.String(allow_none=True)
    full_name = fields.String(allow_none=True)
    link = fields.String(allow_none=True)
    domains = fields.Dict(
        keys=fields.String(), values=fields.Dict(
            keys=fields.String(), values=fields.Nested(EnrichmentValue)), allow_none=True)


class DomainInfo(CamelCaseSchema):
    labels = fields.List(fields.String())


class EnrichmentTextMapping(CamelCaseSchema):
    text = fields.String(required=True)
    row = fields.Integer(required=True)
    domain = fields.String(allow_none=True)
    label = fields.String(allow_none=True)
    matched = fields.Boolean(allow_none=True)
    imported = fields.Boolean(allow_none=True)
    full_name = fields.Boolean(allow_none=True)


# Requests
# ----------------------------------------

class EnrichmentTableSchema(CamelCaseSchema):
    version = fields.String(required=True)
    domain_info = fields.Dict(
        keys=fields.String(), values=fields.Nested(DomainInfo), required=True)
    genes = fields.List(fields.Nested(EnrichedGene), required=True)
