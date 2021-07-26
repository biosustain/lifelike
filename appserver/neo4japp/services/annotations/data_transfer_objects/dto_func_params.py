import attr

from typing import Dict, List

from neo4japp.services.annotations.data_transfer_objects import PDFWord


"""Data Transfer Objects related to consolidating multiple
function parameters into one object.
"""


@attr.s(frozen=True)
class CreateAnnotationObjParams():
    entity: dict = attr.ib()
    entity_category: str = attr.ib()
    entity_id: str = attr.ib()
    entity_id_type: str = attr.ib()
    entity_id_hyperlink: str = attr.ib()
    token: PDFWord = attr.ib()
    token_type: str = attr.ib()
