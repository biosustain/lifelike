from neo4japp.database import ma
from webargs import validate


class StrictSchema(ma.Schema):
    class Meta:
        strict = True


class ProjectBackupSchema(StrictSchema):
    id = ma.Integer(required=True)
    label = ma.String(required=True, validate=validate.Length(max=250))
    description = ma.String()
    date_modified = ma.DateTime()
    graph = ma.Dict(keys=ma.String())
    author = ma.String(required=True, validate=validate.Length(max=240))
    public = ma.Boolean(missing=False)
    user_id = ma.Integer(required=True)
    hash_id = ma.String(required=True, validate=validate.Length(max=50))
