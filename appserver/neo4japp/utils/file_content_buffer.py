import io
from tempfile import SpooledTemporaryFile
from typing import Union, List, BinaryIO, Any, Iterable, Iterator

from neo4japp.constants import MAX_FILE_SIZE


class FileContentBufferBase(BinaryIO):
    """Wrapper around any buffer adding a size limit"""
    _max_size: int
    _stream: Union[io.BytesIO, SpooledTemporaryFile]

    def __init__(self, *args, stream=None, max_size=MAX_FILE_SIZE, **kwargs):
        self._max_size = max_size
        self._stream = stream if stream else io.BytesIO(*args, **kwargs)

    # region overwrites
    def _check_overflow(self, size) -> None:
        if size > self._max_size:
            raise OverflowError()

    def write(self, s: Union[bytes, bytearray]) -> int:
        self._check_overflow(self.tell() + len(s))
        return self._stream.write(s)

    def writelines(self, lines: Iterable[bytes]) -> None:
        def check_and_forward(s):
            self._check_overflow(len(s))
            return s
        self._stream.writelines(
            # Wrap iterable steps to check for overflow
            map(check_and_forward, lines)
        )
    # endregion

    # region forward
    def __iter__(self) -> Iterator[bytes]:
        return self._stream.__iter__()

    def __next__(self) -> bytes:
        return self._stream.__next__()

    @property
    def mode(self) -> str:
        return self._stream.mode

    @property
    def name(self) -> str:
        return self._stream.name

    def close(self) -> None:
        self._stream.close()

    @property
    def closed(self) -> bool:
        return self._stream.closed

    def fileno(self) -> int:
        return self._stream.fileno()

    def flush(self) -> None:
        self._stream.flush()

    def isatty(self) -> bool:
        return self._stream.isatty()

    def read(self, n: int = -1) -> Union[bytes, Any]:
        return self._stream.read(n)

    def readable(self) -> bool:
        return self._stream.readable()

    def readline(self, limit: int = -1) -> Union[bytes, Any]:
        return self._stream.readline(limit)

    def readlines(self, hint: int = -1) -> Union[List[bytes], List[Any]]:
        return self._stream.readlines(hint)

    def seek(self, offset: int, whence: int = 0) -> int:
        return self._stream.seek(offset, whence)

    def seekable(self) -> bool:
        return self._stream.seekable()

    def tell(self) -> int:
        return self._stream.tell()

    def truncate(self, size: int = None) -> int:
        return self._stream.truncate(size)

    def writable(self) -> bool:
        return self._stream.writable()

    def __enter__(self) -> Any:
        return self._stream.__enter__()

    def __exit__(self, type, value, traceback) -> None:
        self._stream.__exit__(type, value, traceback)
    # endregion


class FileContentBufferView(FileContentBufferBase):
    pass


class FileContentBuffer(FileContentBufferBase):
    """Wrapper around any buffer providing context manager to always read starting from 0
    This wrapper disallows direct execution of methods which changes buffer cursor position,
    therefore forcing scoped access through context manager.
    """

    def __enter__(self):
        """Creates "buffer view" which is safe to read as starting position is always at 0"""
        self._stream.seek(0)
        return FileContentBufferView(stream=self._stream, max_size=self._max_size)

    def __exit__(self, *args):
        self._stream.seek(0)

    # region utilities
    @property
    def size(self):
        with self as bufferView:
            bufferView.seek(0, io.SEEK_END)
            return bufferView.tell()

    def getvalue(self):
        with self as bufferView:
            return getattr(bufferView, 'getvalue', bufferView.read)()
    # endregion

    # region diassallowed ussage
    def _not_allowed(self, operation):
        raise IOError(f'Operation "{operation}" not allowed outside of view')

    def __iter__(self) -> Iterator[bytes]:
        self._not_allowed('__iter__')
        return self._stream.__iter__()

    def __next__(self) -> bytes:
        self._not_allowed('__next__')
        return self._stream.__next__()

    def read(self, n: int = -1) -> bytes:
        self._not_allowed('read')
        return self._stream.read(n)

    def readline(self, limit: int = -1) -> Union[bytes, Any]:
        self._not_allowed('readline')
        return self._stream.readline(limit)

    def readlines(self, hint: int = -1) -> Union[List[bytes], List[Any]]:
        self._not_allowed('readlines')
        return self._stream.readlines(hint)

    def seek(self, offset: int, whence: int = 0) -> int:
        self._not_allowed('seek')
        return self._stream.seek(offset, whence)
    # endregion
