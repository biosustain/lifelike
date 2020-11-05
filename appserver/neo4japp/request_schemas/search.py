from marshmallow import fields, validate

from neo4japp.database import ma


class ContentSearchSchema(ma.Schema):
    q = ma.String(required=True)
    types = ma.String(required=True)
    page = ma.Integer(required=True)
    limit = ma.Integer(required=True, validate=validate.Range(min=0, max=1000))


class AnnotateRequestSchema(ma.Schema):
    texts = fields.List(fields.String(validate=validate.Length(min=1, max=1500)),
                        validate=validate.Length(min=1, max=40))


class OrganismSearchSchema(ma.Schema):
    query = ma.String(required=True)
    limit = ma.Integer(required=True, validate=validate.Range(min=0, max=1000))


class VizSearchSchema(ma.Schema):
    query = ma.String(required=True)
    page = ma.Integer(required=True)
    limit = ma.Integer(required=True, validate=validate.Range(min=0, max=1000))
    filter = ma.String(required=True)
    organism = ma.String(required=True)
