from marshmallow import fields, validate

from neo4japp.schemas.base import CamelCaseSchema


class ClientEventSchema(CamelCaseSchema):
    """
    Represents a user action of interest occurring in the client.
    Ressembles common fields used for event tracking by some popular
    analytics tools like Google Analytics, Matomo and others.
    """

    category = fields.String(
        description="The type of event to track. "
                    "(e.g. tabs, files, annotations, sankeys)",
        required=True,
    )

    action = fields.String(
        description="The specific action that is taken. "
                    "(e.g. open, download, save, delete, annotate)",
        required=True,
    )

    label = fields.String(
        description="Optional name or reference to the element that is being interacted with. "
                    "(e.g. my-paper.pdf, my-project, my-search-query)",
        required=False
    )

    value = fields.Number(
        description="Optional positive numeric value. "
                    "(e.g. file size, number of annotations, time spent)",
        requied=False,
        validate=validate.Range(min=0),
        error_messages={"min": "If present, value must be greater than or equal to 0"},
    )

    url = fields.URL(
        description="Reference URL or path related to the event",
        relative=True,
        required=False,
    )
