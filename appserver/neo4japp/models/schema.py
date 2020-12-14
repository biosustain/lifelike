from marshmallow import fields

from neo4japp.database import ma
from neo4japp.models import ModelConverter, Project, ProjectVersion
from neo4japp.schemas.account import UserSchema


class ProjectSchema(ma.ModelSchema):  # type: ignore
    class Meta:
        include_fk = True
        model = Project
        model_converter = ModelConverter


class ProjectVersionListItemSchema(ma.ModelSchema):
    id = fields.Integer()
    author = fields.Method('get_author')
    modified_date = fields.DateTime()

    def get_author(self, version):
        return f"{version.user.first_name} {version.user.last_name}"


class ProjectVersionSchema(ProjectVersionListItemSchema):
    graph = fields.Raw()
