# Filesystem

All files and folders are stored in the `files` table and are often referred to
as "objects" in the API and on the client.

## Properties

Objects have the following properties:

* 0 or 1 parent
* A filename
* A description
* A mime type
* A 'public' flag
* Potentially 0 or more users and their granted roles on the object
* Potentially a reference to a row in `FileContent`
* Recycled status
* Soft delete status

### Hierarchy and Projects

Objects can be hierarchical. Most objects have a parent, except for usually the top-most folder
within a project. Projects themselves define a ***ARANGO_USERNAME*** folder, but objects currently do not
have a project reference (although this may change in the future in the
interests of simplifying certain queries). Files can have children too, although this is
currently not used (as of writing) but it may be exploited in the future to store files that
belong to documents.

Note that because objects do not contain a project reference, you must evaluate an object's
hierarchy to retrieve the project that the object is contained within. As previously mentioned,
we may want to consider denormalizing the project information on a per-object basis in interests
of performance in the future.

### Differentiation

Mime types are how objects are differentiated. Even folders have a mime type of
`vnd.***ARANGO_DB_NAME***.filesystem/directory`.

### Privileges

#### From Roles

Projects can have users with assigned roles (read, write, admin). Objects themselves can have
their own users with assigned roles (read, write, comment). Privileges are hierarchical and
the highest role defined by any item in the hierarchy is the effective role.

As of writing, there is no interface for users to grant access to a specific object, but
the code should fully support such a scenario. Thereforce, the only effective source of role
information comes from the project.

Note that the hierarchical nature of privileges does make many queries difficult because entire
hierarchies have to be evaluated to determine the privileges for a user for an object. Some
future consideration of this problem may be necessary.

#### From 'Public'

Every object also has a 'public' flag that indicates whether any logged in user should have
view access to the object. This flag stacks with roles.

Directories can technically be made public but because not all API endpoints properly perform
hierarchical privilege evaluation (namely 'associated maps'), public directories do not perform
as expected. For that reason, it is not actually possible to make a directory public via the
client or API.

#### Implied Permissions

```python
commentable = any([
    project_manageable,
    project_readable and project_writable,
    file_commentable,
    parent_privileges and parent_privileges.commentable,
])

readable = commentable or any([
    project_manageable,
    project_readable,
    file_readable,
    file.public,
    parent_privileges and parent_privileges.readable,
])

writable = readable and any([
    project_manageable,
    project_writable,
    file_writable,
    parent_privileges and parent_privileges.writable,
])

commentable = commentable or writable
```

### Recycling

Hitting delete on an object on the client recycles it.

All objects can be recycled (trashed). A recycled object is still viewable, but it is generally
not shown in any listings. When an object is recycled, its children are not recycled and
are still both viewable and editable, but there is no easy way to get to the children without
knowing their direct URLs. However, while viewable, editing a recycled object is not permitted
and the UI should warn the user first that the file is recycled.

As of writing, there is no way to see which objects have been recycled, but
in the future, there will be and users will be able to view, restore, or permanently delete (soft
deleted). Until then, behavior regarding children of recycled folders is not yet defined.

Note: In Google Drive, objects can be a part of more than one parent. When a folder is recycled,
its children objects exhibit similar behavior to the behavior described here, but objects in
Google Drive can be made the child of a second parent folder so the object is both within a
recycled folder and also within a non-recycled folder. We may consider this approach in the future.

### Soft Deletes

An object that is soft deleted is kept in the database, but for all intents and purposes, cannot
be accessed by the user. When an object is soft deleted, its children are not affected and
behavior is similar to file recycling. As of writing, there is no way to actually soft delete
an object because recycling effectively makes the file (mostly) unavailable to users, although
not completely and therefore a solution is needed at some point.

## Creating File Types

Creating new file types involves implementing new file type providers in both
AppServer and the client.

You will need to determine a mime type for your file type, and if you are creating a new one
for Lifelike, be sure to follow the convention of the existing mime types:

* `vnd.***ARANGO_DB_NAME***.document/map`
* `vnd.***ARANGO_DB_NAME***.document/enrichment-table`
* `vnd.***ARANGO_DB_NAME***.filesystem/directory`

### AppServer

Implementing a new file type in the server involves:

1. Implementing a provider that extends `BaseFileTypeProvider`.
2. Registering your new provider in the `FileTypeService`.

After registering your provider, your file is officially supported in Lifelike. You
will be able to use all the existing filesystem APIs to work with files
of your file type.

Your file can also be indexed by Elasticsearch if you implement the necessary
methods on your FileTypeProvider implementation.

#### Provider Implementation

Your provider must extend the `BaseFileTypeProvider` class and then you should
override as many relevant methods as possible. See the docstrings for that class
for documentation on the methods.

A demo of a provider is below:

```python
class MapTypeProvider(BaseFileTypeProvider):
    MIME_TYPE = 'vnd.***ARANGO_DB_NAME***.document/map'
    mime_types = (MIME_TYPE,)

    def detect_content_confidence(self, buffer: BufferedIOBase) -> Optional[float]:
        try:
            self.validate_content(buffer)
            return 0
        except ValueError:
            return None
        finally:
            buffer.seek(0)

    def can_create(self) -> bool:
        return True

    def validate_content(self, buffer: BufferedIOBase):
        graph = json.loads(buffer.getvalue())
        validate_map(graph)

    def to_indexable_content(self, buffer: BufferedIOBase):
        content_json = json.load(buffer)
        # ...transform data to be indexable by Elastic...
        return BytesIO(json.dumps(map_data).encode('utf-8'))

    def generate_export(self, file: Files, format: str) -> FileExport:
        # ...generate export
        return FileExport(
            content=BytesIO(graph.pipe()),
            mime_type=extension_mime_types[ext],
            filename=f"{file.filename}{ext}"
        )
```

#### Provider Registration

In `database.py`, be sure to register your new provider:

```python
@scope_flask_app_ctx('file_type_service')
def get_file_type_service():
    from neo4japp.services.file_types.service import FileTypeService
    from neo4japp.services.file_types.providers import EnrichmentTableTypeProvider, \
        MapTypeProvider, PDFTypeProvider, DirectoryTypeProvider
    service = FileTypeService()
    service.register(DirectoryTypeProvider())
    service.register(PDFTypeProvider())
    # ...
    # Add your provider here
    return service
```

### Client

Implementing a new file type in the client involves:

1. Implementing a provider that implements `ObjectTypeProvider`.
2. Registering your new provider as part of an Angular module.
3. Update `FilesystemObject` for your file type.

#### Provider Implementation

Your provider must implement the `ObjectTypeProvider` class and then you should
override as many relevant methods as possible. See the JSDoc comments on that interface
for more information. It's also recommended that you extend the `AbstractObjectTypeProvider`
base class to make implementing the provider easier.

A demo of a provider is below:

```ts
@Injectable()
export class MapTypeProvider extends AbstractObjectTypeProvider {

  constructor(protected readonly componentFactoryResolver: ComponentFactoryResolver,
              protected readonly injector: Injector,
              protected readonly objectCreationService: ObjectCreationService) {
    super();
  }

  handles(object: FilesystemObject): boolean {
    return object.mimeType === 'vnd.***ARANGO_DB_NAME***.document/map';
  }

  createPreviewComponent(object: FilesystemObject) {
    const factory: ComponentFactory<MapComponent<any>> =
      this.componentFactoryResolver.resolveComponentFactory(MapComponent);
    const componentRef = factory.create(this.injector);
    const instance: MapComponent = componentRef.instance;
    instance.locator = object.hashId;
    return of(componentRef);
  }

  getCreateDialogOptions(): RankedItem<CreateDialogAction>[] {
    return [{
      rank: 100,
      item: {
        label: 'Map',
        openSuggested: true,
        create: (options?: CreateActionOptions) => {
          const object = new FilesystemObject();
          object.filename = 'Untitled Map';
          object.mimeType = MAP_MIMETYPE;
          object.parent = options.parent;
          return this.objectCreationService.openCreateDialog(object, {
            title: 'New Map',
            request: {
              contentValue: new Blob([JSON.stringify({
                edges: [],
                nodes: [],
              } as UniversalGraph)]),
            },
            ...(options.createDialog || {}),
          });
        },
      },
    }];
  }

}
```

#### Provider Registration

You will want to register your provider in in the `FileTypesModule`:

```ts
import { TYPE_PROVIDER } from './services/object-type.service';

@NgModule({
  providers: [
    {
      provide: TYPE_PROVIDER,
      useClass: ExampleTypeProvider,
      multi: true,
    },
    // ...
  ],
})
export class FileTypesModule {
}
```

#### FilesystemObject Changes

Unfortunately, not all file type-specific methods have been moved to
`ObjectTypeProvider` -- some are still located on `FilesystemObject`.

Some examples of those methods are as follows:

```ts
class FilesystemObject {
  get isAnnotatable() {
    // TODO: Move this method to ObjectTypeProvider
    return this.mimeType === 'application/pdf';
  }

  get isMovable() {
    // TODO: Move this method to ObjectTypeProvider
    return !(this.isDirectory && !this.parent);
  }

  get isCloneable() {
    // TODO: Move this method to ObjectTypeProvider
    return this.isFile;
  }

  get isDeletable() {
    // TODO: Move this method to ObjectTypeProvider
    return true;
  }
}
```

Be sure to modify the methods for your file type as necessary.