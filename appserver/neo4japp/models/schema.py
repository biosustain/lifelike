from neo4japp.database import ma
from neo4japp.models import Project, ModelConverter


class ProjectSchema(ma.ModelSchema):  # type: ignore
    class Meta:
        include_fk = True
        model = Project
        model_converter = ModelConverter
