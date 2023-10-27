"""Set of generic formatters which can be used to convert data to/from given format.
"""
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, astuple
from datetime import datetime
from typing import Any, Generic, Type, TypedDict, TypeVar, Union
from zipfile import ZipFile, ZipInfo

from neo4japp.constants import BYTE_ENCODING

_FormatterLoads = TypeVar('_FormatterLoads')
_FormatterDumps = TypeVar('_FormatterDumps')


class Formatter(ABC, Generic[_FormatterLoads, _FormatterDumps]):
    @classmethod
    @abstractmethod
    def dumps(cls, obj: _FormatterLoads) -> _FormatterDumps:
        ...

    @classmethod
    @abstractmethod
    def loads(cls, s: _FormatterDumps) -> _FormatterLoads:
        ...


_IDENTITY_FORMATER_VAR = TypeVar('_IDENTITY_FORMATER_VAR')


class IdentityFormatter(
    Generic[_IDENTITY_FORMATER_VAR],
    Formatter[_IDENTITY_FORMATER_VAR, _IDENTITY_FORMATER_VAR],
):
    @classmethod
    def dumps(cls, obj: _IDENTITY_FORMATER_VAR) -> _IDENTITY_FORMATER_VAR:
        return obj

    @classmethod
    def loads(cls, s: _IDENTITY_FORMATER_VAR) -> _IDENTITY_FORMATER_VAR:
        return s


class DateTimeExtraFormatter(Formatter[datetime, str]):
    @classmethod
    def dumps(cls, obj: datetime) -> str:
        return obj.isoformat()

    @classmethod
    def loads(cls, s: str) -> datetime:
        return datetime.fromisoformat(s)


_JSONBFormatterVar = TypeVar('_JSONBFormatterVar')


class JSONBFormatter(Generic[_JSONBFormatterVar], Formatter[_JSONBFormatterVar, bytes]):
    @classmethod
    def dumps(cls, obj: _JSONBFormatterVar) -> bytes:
        return bytes(json.dumps(obj), BYTE_ENCODING)

    @classmethod
    def loads(cls, s: bytes) -> _JSONBFormatterVar:
        return json.loads(s.decode(BYTE_ENCODING))


# region Old syntax for python 3.9
# TODO once migrate to python 3.11 this can be replaced with:
# class _ZipInfoKwargs(TypedDict):
#     filename: str
#     date_time: NotRequired[tuple[int, int, int, int, int, int]]
class _ZipInfoKwargsBase(TypedDict):
    """
    TypedDict for required ZipInfo constructor kwargs.
    """

    filename: str


class _ZipInfoKwargs(_ZipInfoKwargsBase, total=False):
    """
    TypedDict for ZipInfo constructor kwargs.
    Required kwargs are defined in _ZipInfoKwargsBase.
    Optional kwargs are defined here.
    """

    date_time: tuple[int, int, int, int, int, int]


# endregion


_ZIP_FILE_FORMATER_CONTENT = TypeVar('_ZIP_FILE_FORMATER_CONTENT')


# Someday mypy will support generic named tuples, but we are not there yet.
# Someday we will be able to use this:
# LOAD = NamedTuple('LOAD', [('filename', str), ('content', _ZIP_FILE_FORMATER_CONTENT)])
# Until then we have to use dataclass.
@dataclass
class _ZipFileFormatterLoad(Generic[_ZIP_FILE_FORMATER_CONTENT]):
    filename: str
    content: _ZIP_FILE_FORMATER_CONTENT

    # Dataclass destruct like namedtuple
    def __iter__(self):
        yield from astuple(self)


@dataclass
class ZipFileFormatter(Generic[_ZIP_FILE_FORMATER_CONTENT]):
    content_formatter: Type[
        Formatter[_ZIP_FILE_FORMATER_CONTENT, bytes]
    ] = IdentityFormatter

    def dump(
        self,
        zip_file: ZipFile,
        filename: str,
        content: Any,
        *,
        date_time: datetime,
        compress_type=None,
        compresslevel=None,
        **kwargs,
    ) -> None:
        zip_info_kwargs: _ZipInfoKwargs = dict(filename=filename)
        if date_time:
            zip_info_kwargs['date_time'] = date_time.timetuple()[:6]

        info = ZipInfo(**zip_info_kwargs)
        for key, value in kwargs.items():
            setattr(info, key, value)

        zip_file.writestr(
            info,
            self.content_formatter.dumps(content),
            compress_type=compress_type,
            compresslevel=compresslevel,
        )

    def load(
        self, zip_file: ZipFile, info: ZipInfo
    ) -> _ZipFileFormatterLoad[_ZIP_FILE_FORMATER_CONTENT]:
        return _ZipFileFormatterLoad[_ZIP_FILE_FORMATER_CONTENT](
            filename=info.filename,
            content=self.content_formatter.loads(zip_file.read(info)),
        )


__all__ = [
    'Formatter',
    'IdentityFormatter',
    'DateTimeExtraFormatter',
    'JSONBFormatter',
    'ZipFileFormatter',
]
