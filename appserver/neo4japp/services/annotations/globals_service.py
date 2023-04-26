from sqlalchemy import and_

from neo4japp.database import db
from neo4japp.models.annotations import GlobalList
from neo4japp.services.annotations.constants import ManualAnnotationType


def get_global_exclusion_annotations() -> list:
    return [
        d.annotation for d in db.session.query(
            GlobalList.annotation
        ).filter(
            and_(GlobalList.type == ManualAnnotationType.EXCLUSION.value)
        )
    ]
