from marshmallow import fields, validate

from neo4japp.database import ma


class ContentSearchSchema(ma.Schema):
    q = ma.String(required=True)
    types = ma.String(required=True)
    page = ma.Integer(required=True)
    limit = ma.Integer(required=True)


class AnnotateRequestSchema(ma.Schema):
    texts = fields.List(fields.String(validate=validate.Length(min=1, max=1500)),
                        validate=validate.Length(min=1, max=40))
