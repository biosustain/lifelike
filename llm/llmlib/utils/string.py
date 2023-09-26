import itertools
import re
import sys
from enum import Enum
from enum import EnumMeta
from json import JSONDecodeError
from string import punctuation, whitespace
from typing import Iterator, Dict

import attr
import unicodedata
from _decimal import Decimal, InvalidOperation
from flask import json


def indent_lines(*lines: str, level=1, indent_string: str = '\t'):
    return list(map(lambda s: indent_string * level + s, lines))


def compose_lines(*lines: str, new_line_delimeter: str = '\n'):
    return new_line_delimeter.join(lines)


__all__ = [
    'indent_lines',
    'compose_lines',
]
