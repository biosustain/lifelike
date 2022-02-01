import marshmallow.validate
from marshmallow import fields

from neo4japp.schemas.base import CamelCaseSchema


# ========================================
# Requests
# ========================================

class CopyrightInfringementRequestSchema(CamelCaseSchema):
    url = fields.String(required=True)
    description = fields.String(required=True, validate=[marshmallow.validate.Length(min=1, max=1000)])
    name = fields.String(required=True)
    company = fields.String(required=True)
    address = fields.String(required=True)
    country = fields.String(required=True)
    city = fields.String(required=True)
    province = fields.String(required=True)
    zip = fields.String(required=True)
    phone = fields.String(required=True)
    fax = fields.String(required=False, allow_none=True)
    email = fields.Email(required=True)
    attestationCheck1 = fields.Bool(required=True)
    attestationCheck2 = fields.Bool(required=True)
    attestationCheck3 = fields.Bool(required=True)
    attestationCheck4 = fields.Bool(required=True)
    signature = fields.String(required=True)
