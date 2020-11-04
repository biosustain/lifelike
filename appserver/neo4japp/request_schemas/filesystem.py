from marshmallow import fields

from neo4japp.database import ma


class DirectoryDestination(ma.Schema):
    directoryId = fields.Number(required=True)


class MoveFileRequest(ma.Schema):
    destination = fields.Nested(DirectoryDestination, required=True)
