import re
import typing
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from os import path
from typing import (
    List,
    IO,
    Dict,
    Callable,
    Optional,
)
from zipfile import ZipFile

from neo4japp.constants import (
    EXTENSION_MIME_TYPES,
    FILE_MIME_TYPE_DIRECTORY,
)
from neo4japp.database import get_file_type_service
from neo4japp.exceptions import ServerWarning
from neo4japp.models import Files, FileContent
from neo4japp.models.common import generate_hash_id
from neo4japp.services.file_types.exports import FileExport, ExportFormatError
from neo4japp.services.file_types.imports import FileImport, ImportFormatError
from neo4japp.utils import find
from neo4japp.utils.file_content_buffer import FileContentBuffer
from neo4japp.utils.formatters import (
    DateTimeExtraFormatter,
    JSONBFormatter,
    ZipFileFormatter,
)
from neo4japp.utils.globals import warn


class DataExchangeProtocol(ABC):
    FORMAT: str
    EXTENSION: str

    @classmethod
    @abstractmethod
    def generate_export(cls, filename: str, files: List[Files]) -> FileExport:
        ...

    @classmethod
    @abstractmethod
    def generate_import(cls, export: FileExport) -> FileImport:
        ...


# region ZipDataExchange
class _FilesDictToJSONB(JSONBFormatter[dict]):
    _DATETIME_FIELDS = {
        'creation_date',
        'annotations_date',
        'modified_date',
        'deletion_date',
        'recycling_date',
    }

    @classmethod
    def dumps(cls, obj: dict) -> bytes:
        # datetime cannot be serialized directly to json
        for key in cls._DATETIME_FIELDS:
            value = obj.get(key)
            if value:
                obj[key] = DateTimeExtraFormatter.dumps(value)
        return super().dumps(obj)

    @classmethod
    def loads(cls, s: bytes) -> dict:
        obj = super().loads(s)
        # datetime cannot be serialized directly to json
        for key in cls._DATETIME_FIELDS:
            value = obj.get(key)
            if value:
                obj[key] = DateTimeExtraFormatter.loads(value)
        return obj


@dataclass
class _ImportRef:
    metadata: Optional[dict] = None
    file: Files = field(
        default_factory=lambda: Files(
            # Pregenerate hashes so we can use it for linking
            hash_id=generate_hash_id()
        )
    )
    root: bool = False
    path: Optional[str] = None


class _ComposedImportRef:
    metadata: dict
    file: Files
    root: bool
    path: str


class ZipDataExchange(DataExchangeProtocol):
    FORMAT = 'zip'
    EXTENSION = '.zip'
    MIME_TYPE = EXTENSION_MIME_TYPES[EXTENSION]
    _METADATA_FILE_FORMAT = '.{basename}.metadata.json'
    _METADATA_FILE_FORMAT_RE: re.Pattern = re.compile(
        '^'
        + _METADATA_FILE_FORMAT.replace('.', r'\.').format(basename=r'(?P<basename>.+)')
        + '$'
    )
    # Should boil down to: filter(lambda c: not isinstance(c, ForeignKey), Files.__table__.columns)
    _IMPORT_FIELDS = {
        'annotations',
        'custom_annotations',
        'excluded_annotations',
        'enrichment_annotations',
        'filename',
        'creation_date',
        'description',
        'doi',
        'upload_url',
        'annotations_date',
        'modified_date',
        'public',
        'deletion_date',
        'recycling_date',
        'mime_type',
        'annotation_configs',
        'organism_name',
        'organism_synonym',
        'organism_taxonomy_id',
        'pinned',
        'contexts',
    }
    _EXPORT_FIELDS = {
        *_IMPORT_FIELDS,
        # TODO: Ids can be hashed to avoid exposing the real ids
        'id',
        'hash_id',
        'parent_id',
        'path',
        # Additional fields are used to reconstruct the file hierarchy
        # and relink the files
    }

    _zip_file_model_formatter = ZipFileFormatter[bytes]()
    _zip_file_model_metadata_formatter = ZipFileFormatter[dict](
        content_formatter=_FilesDictToJSONB
    )

    @classmethod
    def _export(cls, buffer: IO[bytes], files: List[Files], common_path: str):
        with ZipFile(buffer, 'w') as zip_file:
            for f in files:
                relative_path = path.relpath(f.path, common_path)
                extension = EXTENSION_MIME_TYPES.get_key(f.mime_type, '')
                filename = relative_path + extension

                # Write only if content is not empty (e.g. omit folders)
                if f.content_id is not None:
                    cls._zip_file_model_formatter.dump(
                        zip_file,
                        filename,
                        f.content.raw_file,
                        date_time=f.modified_date,
                    )

                metadata = {
                    key: getattr(f, key)
                    for key in cls._EXPORT_FIELDS
                    if getattr(f, key, None) is not None
                }

                dirname = path.dirname(filename)
                basename = path.basename(filename)
                metadata_filename = path.join(
                    dirname, cls._METADATA_FILE_FORMAT.format(basename=basename)
                )
                cls._zip_file_model_metadata_formatter.dump(
                    zip_file,
                    metadata_filename,
                    metadata,
                    date_time=f.creation_date,
                )

    @classmethod
    def _load_zip_imports(
        cls, buffer: IO[bytes], import_ref_getter: Callable[[str], _ImportRef]
    ) -> None:
        with ZipFile(buffer) as zip_file:  # only reading
            for info in zip_file.infolist():
                if info.is_dir():
                    continue
                else:
                    dirname = path.dirname(info.filename)
                    basename = path.basename(info.filename)
                    metadata_file = cls._METADATA_FILE_FORMAT_RE.match(basename)
                    if metadata_file:
                        basename = metadata_file.group('basename')
                    import_ref = import_ref_getter(path.join(dirname, basename))
                    if metadata_file:
                        import_ref.root = dirname == ''
                        import_ref.path = info.filename

                        metadata_file_ref = cls._zip_file_model_metadata_formatter.load(
                            zip_file, info
                        )
                        if import_ref.metadata is not None:
                            warn(ServerWarning(title="Metadata already set."))
                        import_ref.metadata = metadata_file_ref.content
                        # Apply metadata import fields
                        for column, value in import_ref.metadata.items():
                            if column in cls._IMPORT_FIELDS:
                                setattr(import_ref.file, column, value)
                    else:
                        file_ref = cls._zip_file_model_formatter.load(zip_file, info)
                        # Draft FileContent instance (buffer can be changed later)
                        # assert import_ref.file.content is None, "Content already set."
                        if import_ref.file.content is not None:
                            warn(ServerWarning(title='File content already set'))
                        import_ref.file.content = FileContent()
                        import_ref.file.content.raw_file = FileContentBuffer(
                            file_ref.content
                        )

    @classmethod
    def _imports_consistency_check(
        cls, import_path_map: Dict[str, _ImportRef]
    ) -> Dict[str, _ComposedImportRef]:
        for zip_path, import_ref in import_path_map.copy().items():
            if import_ref.metadata is None:
                warn(
                    ServerWarning(
                        title='Missing metadata',
                        message=f'Could not find metadata for file: {zip_path}',
                        additional_msgs=('The file will be skipped.',),
                    )
                )
                del import_path_map[zip_path]
            if (
                import_ref.file.mime_type != FILE_MIME_TYPE_DIRECTORY
                and import_ref.file.content is None
            ):
                warn(
                    ServerWarning(
                        title='Missing file content',
                        message=f'Missing content for file: {zip_path}',
                        additional_msgs=('The file will be skipped.',),
                    )
                )
                del import_path_map[zip_path]

        # cast to _ComposedImportRef since we checked that the _ImportRef is properly initialized
        return typing.cast(Dict[str, _ComposedImportRef], import_path_map)

    @classmethod
    def _imports_rebuild_hierarhy(
        cls, import_path_map: Dict[str, _ComposedImportRef]
    ) -> None:
        import_id_map = {
            import_ref.metadata['id']: import_ref
            for import_ref in import_path_map.values()
            if 'id' in import_ref.metadata
        }
        for import_ref in import_id_map.values():
            if not import_ref.root:  # Skip parents of import root files
                parent_id = import_ref.metadata.get('parent_id')
                parent_import_ref = import_id_map.get(parent_id)
                assert (
                    parent_import_ref is not import_ref
                ), "File cannot be its own parent."
                if parent_import_ref:
                    assert (
                        parent_import_ref.file.mime_type == FILE_MIME_TYPE_DIRECTORY
                    ), "Parent must be a directory."
                    import_ref.file.parent = parent_import_ref.file
                else:
                    warn(
                        ServerWarning(
                            title='Missing parent',
                            message=f"Could not find the parent of file {import_ref.path}.",
                            additional_msgs=(
                                'The file will be added to import root.',
                                'This might lead to naming conflict results,'
                                ' in case of which import will fail.',
                            ),
                        )
                    )

    @classmethod
    def _imports_relink_files(
        cls, import_path_map: Dict[str, _ComposedImportRef]
    ) -> None:
        files_hash_id_map = {
            import_ref.metadata['hash_id']: import_ref.file.hash_id
            for import_ref in import_path_map.values()
            if 'hash_id' in import_ref.metadata
        }
        for import_ref in import_path_map.values():
            get_file_type_service().relink_file(import_ref.file, files_hash_id_map)

    @classmethod
    def _import(cls, buffer: IO[bytes]) -> List[Files]:
        import_path_map: Dict[str, _ImportRef] = dict()

        def get_import_ref(zip_path_: str) -> _ImportRef:
            print(zip_path_)
            if zip_path_ not in import_path_map:
                import_path_map[zip_path_] = _ImportRef()
            return import_path_map[zip_path_]

        cls._load_zip_imports(buffer, get_import_ref)

        # Consistency check
        composed_import_path_map = cls._imports_consistency_check(import_path_map)

        # Rebuild file hierarchy
        cls._imports_rebuild_hierarhy(composed_import_path_map)

        # Relink files
        cls._imports_relink_files(composed_import_path_map)

        return list(import_ref.file for import_ref in import_path_map.values())

    @classmethod
    def generate_import(cls, export: FileExport) -> FileImport:
        with export.content as bufferView:
            files = cls._import(bufferView)

        return FileImport(
            files=files,
            filename=export.filename,
        )

    @classmethod
    def generate_export(cls, filename: str, files: List[Files]) -> FileExport:
        common_path = (
            path.commonpath([path.dirname(f.path) for f in files]) if len(files) else ''
        )

        content = FileContentBuffer()

        with content as bufferView:
            cls._export(bufferView, files, common_path)

        return FileExport(
            content=content,
            mime_type=cls.MIME_TYPE,
            filename=f"{filename}{cls.EXTENSION}",
        )


# endregion


class DataExchange:
    EXCHANGE_PROVIDERS = (ZipDataExchange,)

    @staticmethod
    def generate_export(filename: str, files: List[Files], format_: str) -> FileExport:
        exchange_provider = find(
            lambda provider: provider.FORMAT == format_, DataExchange.EXCHANGE_PROVIDERS
        )
        if not exchange_provider:
            raise ExportFormatError()

        return exchange_provider.generate_export(filename, files)

    @staticmethod
    def generate_import(export: FileExport) -> FileImport:
        exchange_provider = find(
            lambda provider: provider.MIME_TYPE == export.mime_type,
            DataExchange.EXCHANGE_PROVIDERS,
        )
        if not exchange_provider:
            raise ImportFormatError()

        return exchange_provider.generate_import(export)
