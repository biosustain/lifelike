from collections import namedtuple


class ImportFormatError(Exception):
    pass


FileImport = namedtuple('FileImport', ['files', 'filename'])
