from neo4japp.database import ma


class ContentSearchSchema(ma.Schema):
    q = ma.String(required=True)
    types = ma.String(required=True)
    page = ma.Integer(required=True)
    limit = ma.Integer(required=True)
