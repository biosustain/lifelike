from marshmallow import fields
from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.account import UserProfileSchema


class LifelikeJWTTokenSchema(CamelCaseSchema):
    sub = fields.String()
    iat = fields.DateTime()
    exp = fields.DateTime()
    token_type = fields.String()
    token = fields.String()


class LifelikeJWTTokenResponse(CamelCaseSchema):
    access_token = fields.Nested(LifelikeJWTTokenSchema)
    refresh_token = fields.Nested(LifelikeJWTTokenSchema)
    user = fields.Nested(UserProfileSchema)
