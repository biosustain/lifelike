from neo4japp.database import ma


class StrictSchema(ma.Schema):
    class Meta:
        strict = True


class LinksSchema(StrictSchema):
    ncbi = ma.String(required=True)
    uniprot = ma.String(required=True)
    wikipedia = ma.String(required=True)
    google = ma.String(required=True)


class MetaSchema(StrictSchema):
    type = ma.String(required=True)
    color = ma.String(required=True)
    id = ma.String(required=True)
    idType = ma.String(required=True)
    idHyperlink = ma.String(required=True)
    isCustom = ma.Boolean(required=True)
    allText = ma.String(required=True)
    links = ma.Nested(LinksSchema, required=True)
    primaryLink = ma.String(required=True)


class AnnotationSchema(StrictSchema):
    uuid = ma.String(required=True)
    pageNumber = ma.Integer(required=True)
    keywords = ma.List(ma.String(required=True))
    rects = ma.List(ma.List(ma.Float(required=True)))
    meta = ma.Nested(MetaSchema, required=True)


class AnnotationAdditionSchema(StrictSchema):
    annotation = ma.Nested(AnnotationSchema, required=True)
    annotateAll = ma.Boolean(required=True)


class AnnotationRemovalSchema(StrictSchema):
    uuid = ma.String(required=True)
    removeAll = ma.Boolean(required=True)


class AnnotationExclusionSchema(StrictSchema):
    id = ma.String(required=True)
    idHyperlink = ma.String(required=True)
    text = ma.String(required=True)
    type = ma.String(required=True)
    rects = ma.List(ma.List(ma.Float(required=True)))
    pageNumber = ma.Integer(required=True)
    reason = ma.String(required=True)
    comment = ma.String(required=True)
