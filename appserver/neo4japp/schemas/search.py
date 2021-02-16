from marshmallow import fields, validate

from neo4japp.database import ma
from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.common import ResultListSchema
from neo4japp.schemas.filesystem import RankedFileSchema


# ========================================
# Content Search
# ========================================

# Requests
# ----------------------------------------


class ContentSearchSchema(CamelCaseSchema):
    q = ma.String(
        required=True,
        validate=validate.Regexp(
            regex=r'.*\S.*',
            error='Search query cannot contain only whitespace characters.'
        )
    )
    mime_types = fields.List(fields.String(), min=0, max=100,
                             missing=lambda: ['vnd.lifelike.document/map',
                                              'vnd.lifelike.document/enrichment-table',
                                              'application/pdf'])


# Response
# ----------------------------------------


class ContentSearchResponseSchema(ResultListSchema):
    results = fields.List(fields.Nested(RankedFileSchema))


# ========================================
# Text Annotation API
# ========================================

class AnnotateRequestSchema(ma.Schema):
    texts = fields.List(fields.String(validate=validate.Length(min=1, max=1500)),
                        validate=validate.Length(min=1, max=40))


# ========================================
# Organisms
# ========================================

class OrganismSearchSchema(ma.Schema):
    query = ma.String(required=True)
    limit = ma.Integer(required=True, validate=validate.Range(min=0, max=1000))


# ========================================
# Visualizer
# ========================================

class VizSearchSchema(ma.Schema):
    query = ma.String(required=True)
    page = ma.Integer(required=True, validate=validate.Range(min=1))
    limit = ma.Integer(required=True, validate=validate.Range(min=0, max=1000))
    domains = ma.List(ma.String(required=True))
    entities = ma.List(ma.String(required=True))
    organism = ma.String(required=True)
