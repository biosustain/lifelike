from neo4japp.database import ma
from neo4japp.models import ModelConverter, Project, ProjectVersion


class ProjectSchema(ma.ModelSchema):  # type: ignore
    class Meta:
        include_fk = True
        model = Project
        model_converter = ModelConverter


class ProjectVersionSchema(ma.ModelSchema):  # type: ignore
    class Meta:
        include_fk = True
        model = ProjectVersion
        model_converter = ModelConverter
