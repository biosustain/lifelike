import marshmallow.validate
import marshmallow_dataclass
from marshmallow import fields, validates_schema, ValidationError

from neo4japp.models import Files, Projects
from neo4japp.models.files import FilePrivileges, FileLock
from neo4japp.models.projects import ProjectPrivileges
from neo4japp.schemas.account import UserSchema
from neo4japp.schemas.annotations import AnnotationMethod, FallbackOrganismSchema
from neo4japp.schemas.base import CamelCaseSchema
from neo4japp.schemas.common import ResultListSchema, ResultMappingSchema, SingleResultSchema, \
    RankedItemSchema
from neo4japp.schemas.fields import SortField, FileUploadField, NiceFilenameString
from neo4japp.services.file_types.providers import DirectoryTypeProvider


# ========================================
# Projects
# ========================================


class ProjectSchema(CamelCaseSchema):
    hash_id = fields.String()
    name = fields.String()
    description = fields.String()
    creation_date = fields.DateTime()
    modified_date = fields.DateTime()
    privileges = fields.Method('get_privileges')
    ***ARANGO_USERNAME*** = fields.Nested(lambda: FileHashIdSchema())

    def get_user_privilege_filter(self):
        try:
            return self.context['user_privilege_filter']
        except KeyError:
            raise RuntimeError('user_privilege_filter context key should be set '
                               'for ProjectSchema to determine what to show')

    def get_privileges(self, obj: Projects):
        privilege_user_id = self.get_user_privilege_filter()
        if privilege_user_id is not None and obj.calculated_privileges:
            return ProjectPrivilegesSchema(context=self.context) \
                .dump(obj.calculated_privileges[privilege_user_id])
        else:
            return None


class FileHashIdSchema(CamelCaseSchema):
    hash_id = fields.String()


ProjectPrivilegesSchema = marshmallow_dataclass.class_schema(ProjectPrivileges)


# Requests
# ----------------------------------------

class ProjectListRequestSchema(CamelCaseSchema):
    sort = SortField(columns={
        'name': Projects.name
    }, missing=lambda: [Projects.name])


class ProjectListSchema(ResultListSchema):
    results = fields.List(fields.Nested(ProjectSchema))


class ProjectSearchRequestSchema(ProjectListRequestSchema):
    name = fields.String(required=True)


class ProjectCreateSchema(CamelCaseSchema):
    name = fields.String(required=True,
                         validators=[
                             marshmallow.validate.Regexp('^[A-Za-z0-9-]+$'),
                             marshmallow.validate.Length(min=1, max=50),
                         ])
    description = fields.String(validate=marshmallow.validate.Length(max=1024 * 500))


class BulkProjectRequestSchema(CamelCaseSchema):
    hash_ids = fields.List(fields.String(validate=marshmallow.validate.Length(min=1, max=200)),
                           required=True,
                           validate=marshmallow.validate.Length(min=1, max=100))


class ProjectUpdateRequestSchema(BulkProjectRequestSchema):
    pass


class BulkProjectUpdateRequestSchema(CamelCaseSchema):
    name = fields.String(required=True, validate=marshmallow.validate.Length(min=1, max=200))
    description = fields.String(validate=marshmallow.validate.Length(min=0, max=2048))


# Response
# ----------------------------------------

class ProjectResponseSchema(SingleResultSchema):
    result = fields.Nested(ProjectSchema)


class MultipleProjectResponseSchema(ResultMappingSchema):
    mapping = fields.Dict(keys=fields.String(),
                          values=fields.Nested(ProjectSchema))


# ========================================
# Objects
# ========================================


FilePrivilegesSchema = marshmallow_dataclass.class_schema(FilePrivileges)


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
    project = fields.Method('get_project', exclude='***ARANGO_USERNAME***')
    privileges = fields.Method('get_privileges')
    highlight = fields.Method('get_highlight')
    recycled = fields.Boolean()
    effectively_recycled = fields.Boolean()
    fallback_organism = fields.Nested(FallbackOrganismSchema)
    annotation_configs = fields.Dict(
        keys=fields.String(),
        values=fields.Nested(AnnotationMethod)
    )

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

    def get_highlight(self, obj: Files):
        return obj.calculated_highlight

    def get_project(self, obj: Files):
        return ProjectSchema(context=self.context, exclude=(
            '***ARANGO_USERNAME***',
        )).dump(obj.calculated_project)

    def get_parent(self, obj: Files):
        privilege_user_id = self.get_user_privilege_filter()
        if obj.parent is not None and (privilege_user_id is None
                                       or obj.parent.calculated_privileges[
                                           privilege_user_id].readable):
            return FileSchema(context=self.context, exclude=(
                'project',
                'children',
            )).dump(obj.parent)
        else:
            return None

    def get_children(self, obj: Files):
        privilege_user_id = self.get_user_privilege_filter()
        if obj.calculated_children is not None:
            children = [
                child for child in obj.calculated_children
                if
                privilege_user_id is None or child.calculated_privileges[privilege_user_id].readable
            ]
            return FileSchema(context=self.context, exclude=(
                'project',
                'parent',
            ), many=True).dump(children)
        else:
            return None


class RankedFileSchema(RankedItemSchema):
    item = fields.Nested(FileSchema)


# Requests
# ----------------------------------------

class BulkFileRequestSchema(CamelCaseSchema):
    hash_ids = fields.List(fields.String(validate=marshmallow.validate.Length(min=1, max=200)),
                           required=True,
                           validate=marshmallow.validate.Length(min=1, max=100))


class FileSearchRequestSchema(CamelCaseSchema):
    type = fields.String(required=True, validate=marshmallow.validate.OneOf([
        'public',
        'linked',
    ]))
    linked_hash_id = fields.String(validate=marshmallow.validate.Length(min=1, max=36))
    mime_types = fields.List(fields.String(), required=True,
                             validate=marshmallow.validate.Length(min=1))
    sort = SortField(columns={
        'filename': Files.filename,
        'creationDate': Files.creation_date,
        'modificationDate': Files.modified_date,
    })

    @validates_schema
    def validate_options(self, data, **kwargs):
        if data['type'] == 'linked':
            if data.get('linked_hash_id') is None:
                raise ValidationError("A linkedHashId is required.", 'linked_hash_id')


class BulkFileUpdateRequestSchema(CamelCaseSchema):
    filename = NiceFilenameString(required=True,
                                  validate=marshmallow.validate.Length(min=1, max=200))
    parent_hash_id = fields.String(required=True,
                                   validate=marshmallow.validate.Length(min=1, max=36))
    description = fields.String(validate=marshmallow.validate.Length(min=0, max=2048))
    upload_url = fields.String(validate=marshmallow.validate.Length(min=0, max=2048))
    public = fields.Boolean(default=False)
    content_value = fields.Field(required=False)


class FileUpdateRequestSchema(BulkFileUpdateRequestSchema):
    pass


class FileCreateRequestSchema(FileUpdateRequestSchema):
    mime_type = fields.String(validate=marshmallow.validate.Length(min=1, max=2048))
    content_hash_id = fields.String(validate=marshmallow.validate.Length(min=1, max=36))
    content_url = fields.URL()
    content_value = FileUploadField(required=False)

    @validates_schema
    def validate_content(self, data, **kwargs):
        mime_type = data.get('mime_type')
        provided_content_sources = []
        for key in ['content_hash_id', 'content_url', 'content_value']:
            if data.get(key) is not None:
                provided_content_sources.append(key)
        if mime_type == DirectoryTypeProvider.MIME_TYPE:
            if len(provided_content_sources) != 0:
                raise ValidationError("Directories cannot have any content.")
        else:
            if len(provided_content_sources) == 0:
                raise ValidationError(
                    "Content must be provided from an upload, a URL, or an existing file.")
            elif len(provided_content_sources) > 1:
                raise ValidationError("More than one source of content cannot be specified.")


class FileExportRequestSchema(CamelCaseSchema):
    format = fields.String(required=True)


# Response
# ----------------------------------------


class FileResponseSchema(SingleResultSchema):
    result = fields.Nested(FileSchema, exclude=('project.***ARANGO_USERNAME***',))


class MultipleFileResponseSchema(ResultMappingSchema):
    mapping = fields.Dict(keys=fields.String(),
                          values=fields.Nested(FileSchema, exclude=('project.***ARANGO_USERNAME***',)))


class FileListSchema(ResultListSchema):
    results = fields.List(fields.Nested(FileSchema))


# ========================================
# Backups
# ========================================

# Requests
# ----------------------------------------

class FileBackupCreateRequestSchema(CamelCaseSchema):
    content_value = FileUploadField(required=True)


# ========================================
# Versions
# ========================================


class FileVersionSchema(CamelCaseSchema):
    hash_id = fields.String()
    message = fields.String()
    user = fields.Nested(UserSchema)
    creation_date = fields.DateTime()


class FileVersionHistorySchema(ResultListSchema):
    object = fields.Nested(FileSchema, exclude=('project.***ARANGO_USERNAME***',))
    results = fields.List(fields.Nested(FileVersionSchema))


# Responses
# ----------------------------------------

class FileVersionResponseSchema(CamelCaseSchema):
    version = fields.Nested(FileVersionSchema)


# ========================================
# File Locks
# ========================================

class FileLockSchema(CamelCaseSchema):
    user = fields.Nested(UserSchema)
    acquire_date = fields.DateTime()
    own = fields.Method('get_own')

    def get_own(self, obj: FileLock):
        return self.context['current_user'].id == obj.user.id


# Requests
# ----------------------------------------

class FileLockCreateRequest(CamelCaseSchema):
    own = fields.Boolean(required=True, validate=marshmallow.validate.OneOf([True]))


class FileLockDeleteRequest(CamelCaseSchema):
    own = fields.Boolean(required=True, validate=marshmallow.validate.OneOf([True]))


# Responses
# ----------------------------------------

class FileLockListResponse(ResultListSchema):
    results = fields.List(fields.Nested(FileLockSchema))
