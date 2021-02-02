from marshmallow import fields, validate

from neo4japp.database import ma


class ContentSearchSchema(ma.Schema):
    q = ma.String(
        default='',
        validate=validate.Regexp(
            regex=r'(.*\S.*)|(^$)',
            error='Search query cannot contain only whitespace characters.'
        )
    )
    page = ma.Integer(required=True)
    limit = ma.Integer(required=True, validate=validate.Range(min=0, max=1000))


class AdvancedContentSearchSchema(ContentSearchSchema):
    types = ma.String(default='', required=False)
    projects = ma.String(default='', required=False)


class AnnotateRequestSchema(ma.Schema):
    texts = fields.List(fields.String(validate=validate.Length(min=1, max=1500)),
                        validate=validate.Length(min=1, max=40))


class OrganismSearchSchema(ma.Schema):
    query = ma.String(required=True)
    limit = ma.Integer(required=True, validate=validate.Range(min=0, max=1000))


class VizSearchSchema(ma.Schema):
    query = ma.String(required=True)
    page = ma.Integer(required=True, validate=validate.Range(min=1))
    limit = ma.Integer(required=True, validate=validate.Range(min=0, max=1000))
    domains = ma.List(ma.String(required=True))
    entities = ma.List(ma.String(required=True))
    organism = ma.String(required=True)
