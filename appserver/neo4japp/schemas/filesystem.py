from dataclasses import dataclass, field
from typing import Any

import marshmallow.validate
import marshmallow_dataclass
from marshmallow import fields, Schema, validates_schema, ValidationError

from neo4japp.models import Files, Projects
from neo4japp.models.files import FilePrivileges
from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.fields import SortField


class UserSchema(CamelCaseSchema):
    hash_id = fields.String()
    username = fields.String()
    first_name = fields.String()
    last_name = fields.String()


class ProjectSchema(CamelCaseSchema):
    hash_id = fields.String()
    name = fields.String()
    description = fields.String()
    creation_date = fields.DateTime()
    modified_date = fields.DateTime()
    root = fields.Nested(lambda: FileHashIdSchema())


class ProjectListRequestSchema(CamelCaseSchema):
    sort = SortField(columns={
        'name': Projects.name
    })


class ProjectListSchema(CamelCaseSchema):
    total = fields.Integer()
    results = fields.List(fields.Nested(ProjectSchema))


FilePrivilegesSchema = marshmallow_dataclass.class_schema(FilePrivileges)


class FileHashIdSchema(CamelCaseSchema):
    hash_id = fields.String()


class FileSchema(CamelCaseSchema):
    hash_id = fields.String()
    filename = fields.String()
    user = fields.Nested(UserSchema)
    description = fields.String()
    mime_type = fields.String()
    doi = fields.String()
    upload_url = fields.String()
    public = fields.Boolean()
    annotations_date = fields.DateTime()
    creation_date = fields.DateTime()
    modified_date = fields.DateTime()
    recycling_date = fields.DateTime()
    parent = fields.Method('get_parent')
    children = fields.Method('get_children')
    project = fields.Method('get_project', exclude='root')
    privileges = fields.Method('get_privileges')
    recycled = fields.Boolean()
    effectively_recycled = fields.Boolean()

    def get_user_privilege_filter(self):
        try:
            return self.context['user_privilege_filter']
        except KeyError:
            raise RuntimeError('user_privilege_filter context key should be set '
                               'for FileSchema to determine what to show')

    def get_privileges(self, obj: Files):
        privilege_user_id = self.get_user_privilege_filter()
        if privilege_user_id is not None and obj.calculated_privileges:
            return FilePrivilegesSchema(context=self.context) \
                .dump(obj.calculated_privileges[privilege_user_id])
        else:
            return None

    def get_project(self, obj: Files):
        return ProjectSchema(context=self.context, exclude=(
            'root',
        )).dump(obj.calculated_project)

    def get_parent(self, obj: Files):
        privilege_user_id = self.get_user_privilege_filter()
        if obj.parent is not None and (privilege_user_id is None
                                       or obj.parent.calculated_privileges[privilege_user_id].readable):
            return FileSchema(context=self.context, exclude=(
                'project',
                'children',
            )).dump(obj.parent)
        else:
            return None

    def get_children(self, obj: Files):
        privilege_user_id = self.get_user_privilege_filter()
        if obj.calculated_children is not None:
            return FileSchema(context=self.context, exclude=(
                'project',
                'parent',
            ), many=True).dump([
                child for child in obj.calculated_children
                if privilege_user_id is None
                   or child.calculated_privileges[privilege_user_id].readable
            ])
        else:
            return None


class FileListSchema(CamelCaseSchema):
    total = fields.Integer()
    results = fields.List(fields.Nested(FileSchema))


@dataclass
class FileUpdateRequest:
    filename: str = None
    parent_hash_id: str = None
    description: str = None
    mime_type: str = None
    upload_url: str = None
    content_value: Any = None
    public: bool = None


class BulkFileRequestSchema(CamelCaseSchema):
    hash_ids = fields.List(fields.String(validate=marshmallow.validate.Length(min=1, max=200)),
                           required=True,
                           validate=marshmallow.validate.Length(min=1, max=100))


class BulkFileUpdateRequestSchema(CamelCaseSchema):
    filename = fields.String(required=True, validate=marshmallow.validate.Length(min=1, max=200))
    parent_hash_id = fields.String(required=True, validate=marshmallow.validate.Length(min=1, max=36))
    description = fields.String(validate=marshmallow.validate.Length(min=1, max=2048))
    upload_url = fields.String(validate=marshmallow.validate.Length(min=0, max=2048))
    public = fields.Boolean(default=False)


class FileListRequestSchema(CamelCaseSchema):
    type = fields.String(required=True,
                         validate=marshmallow.validate.OneOf(['public']))
    sort = SortField(columns={
        'filename': Files.filename
    })


class FileUpdateRequestSchema(BulkFileUpdateRequestSchema):
    content_value = fields.Field(required=False)


class FileCreateRequestSchema(FileUpdateRequestSchema):
    mime_type = fields.String(validate=marshmallow.validate.Length(min=1, max=2048))
    content_hash_id = fields.String(validate=marshmallow.validate.Length(min=1, max=36))
    content_url = fields.URL()
    content_value = fields.Field(required=False)

    @validates_schema
    def validate_content(self, data, **kwargs):
        mime_type = data.get('mime_type')
        provided_content_sources = []
        for key in ['content_hash_id', 'content_url', 'content_value']:
            if data.get(key) is not None:
                provided_content_sources.append(key)
        if mime_type == Files.DIRECTORY_MIME_TYPE:
            if len(provided_content_sources) != 0:
                raise ValidationError("Directories cannot have any content.")
        else:
            if len(provided_content_sources) == 0:
                raise ValidationError("Content must be provided from an upload, a URL, or an existing file.")
            elif len(provided_content_sources) > 1:
                raise ValidationError("More than one source of content cannot be specified.")


@dataclass
class FileResponse:
    object: Files = field(metadata={
        'marshmallow_field': fields.Nested(FileSchema),
    })


class FileResponseSchema(CamelCaseSchema):
    object = fields.Nested(FileSchema, exclude=('project.root',))


class MultipleFileResponseSchema(CamelCaseSchema):
    objects = fields.Dict(keys=fields.String(),
                          values=fields.Nested(FileSchema, exclude=('project.root',)))
