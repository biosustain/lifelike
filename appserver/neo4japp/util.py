import json

import attr
import hashlib
import itertools

from decimal import Decimal, InvalidOperation
from enum import EnumMeta, Enum
from flask import json
from json import JSONDecodeError
from string import punctuation, whitespace
from typing import Any, Iterator, Dict


def normalize_str(s) -> str:
    normalized = s.lower()
    normalized = normalized.translate(str.maketrans('', '', punctuation))
    return normalized.translate(str.maketrans('', '', whitespace))


def standardize_str(s) -> str:
    standardized = s.translate(str.maketrans('', '', punctuation))
    return " ".join(standardized.split())


def encode_to_str(obj):
    """Converts different types into a string representation."""
    if isinstance(obj, str):
        return obj
    elif isinstance(obj, Enum):
        return obj.name
    elif isinstance(obj, int) or isinstance(obj, Decimal):
        return str(obj)
    else:
        raise TypeError(f'No conversion definition for {obj}')


def _snake_to_camel_update(k, v):
    return {snake_to_camel(encode_to_str(k)): v}


def snake_to_camel_dict(d, new_dict: dict) -> dict:
    """Converts a snake_case dict to camelCase while taking into
    consideration a nested list or dict as a value.
    """
    if type(d) is not dict:
        return d
    for k, v in d.items():
        if callable(getattr(v, 'to_dict', None)):
            new_dict.update(_snake_to_camel_update(k, v.to_dict()))
        elif type(v) is list:
            new_dict.update(
                _snake_to_camel_update(k, [snake_to_camel_dict(i, {}) for i in v])
            )
        elif type(v) is dict:
            new_dict.update(_snake_to_camel_update(k, snake_to_camel_dict(v, {})))
        else:
            new_dict.update(_snake_to_camel_update(k, v))
    return new_dict


def snake_to_camel(v):
    if v is None:
        return None
    if callable(getattr(v, 'to_dict', None)):
        return v.to_dict()
    elif type(v) is list:
        return [snake_to_camel(item) for item in v]
    elif type(v) is dict:
        return {snake_to_camel(k): snake_to_camel(v) for k, v in v.items()}
    elif type(v) is str:
        parts = v.split('_')
        return parts[0] + ''.join(x.capitalize() or '_' for x in parts[1:])
    else:
        return v


def camel_to_snake(s):
    """Converts camelCase to snake_case.

    The SO (stackoverflow) answer has a simple function:

        import re
        def convert(name):
            s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
            return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

    But its performance can be improved by about 33% with this
    function, a simple hand translation of the regex matching
    algorithm.  Measured with timeit, speed improves from 122 ms to 78
    ms after 10K invocation

    """
    if not s:
        return s
    if len(s) == 1:
        return s.lower()

    buf = [s[0].lower()]
    prev_is_uppercase = s[0].isupper()

    # scan from the second char, with one lookahead
    normal, lookahead = itertools.tee(s[1:])
    next(lookahead)

    for c, ahead in itertools.zip_longest(normal, lookahead):
        # only add an underscore in front of an uppercase if it is not
        # preceded by an uppercase and is followed by a lowercase
        if c.isupper():
            if not prev_is_uppercase or (ahead and ahead.islower()):
                buf.append('_')
            prev_is_uppercase = True
        else:
            prev_is_uppercase = False
        buf.append(c.lower())

    return ''.join(buf)


def camel_to_snake_dict(d, new_dict: dict) -> dict:
    """Converts a camelCase dict to snake case while taking into
    consideration a nested list or dict as a value.
    """
    if type(d) is not dict:
        return d
    for k, v in d.items():
        if type(v) is list:
            new_dict.update(
                {camel_to_snake(k): [camel_to_snake_dict(i, {}) for i in v]}
            )
        elif type(v) is dict:
            new_dict.update({camel_to_snake(k): camel_to_snake_dict(v, {})})
        elif type(v) is str:
            # check if a number then convert to Decimal
            # otherwise check if a string representation of dictionary
            try:
                v = Decimal(v)
                # convert back because this is just to avoid
                # json.loads() from converting to a float
                v = str(v)
                new_dict.update({camel_to_snake(k): v})
                continue
            except InvalidOperation:
                pass
            try:
                v = json.loads(v)
                if type(v) is not list:
                    new_dict.update({camel_to_snake(k): camel_to_snake_dict(v, {})})
                else:
                    obj_list = [camel_to_snake_dict(obj, {}) for obj in v]
                    new_dict.update({camel_to_snake(k): obj_list})

            except JSONDecodeError:
                # not a string representation of JSON or number type
                new_dict.update({camel_to_snake(k): v})
        else:
            # for booleans, etc
            new_dict.update({camel_to_snake(k): v})
    return new_dict


class DictMixin:
    def build_from_dict_formatter(self, d: dict):
        """Returns a formatted version of the input dictionary. Default
        function definition simply returns the input without formatting.

        Intended to be used by any attr.s classes that have attribute
        names we want to format when we get them from the client, e.g.
        'from' to 'from_'. Used in build_from_dict.
        """
        return d

    @classmethod
    def build_from_dict(cls, json_dict):
        """Returns an instance of the class based on a
        snake_case dictionary. Takes into consideration
        values of key in dictionary that are also instances of
        attrs classes. Handle deep nesting by recursing
        back into cls.build_from_dict() using the subclass typing.

        Argument:
            json_dict is a snake_case dictionary used to instantiate
        """
        cls_attrs = attr.fields(cls)
        attributes = {}

        json_dict = cls.build_from_dict_formatter(cls, json_dict)

        for a in cls_attrs:
            if a.name in json_dict:
                # this is to check if a mypy typing
                if hasattr(a.type, '__args__') and a.type.__args__:
                    # check for Unions[<typing>, None], etc
                    # and get the first type
                    attr_type = a.type.__args__[0]
                else:
                    # for built in types or mypy typing
                    # that doesn't have __args__
                    attr_type = a.type

                # if the value of key is also an attrs class
                # create an instance of it
                value = json_dict.get(a.name)
                if value and issubclass(attr_type, CamelDictMixin):
                    # assumption is if attr_type is a subclass
                    # then value must be type dict
                    if isinstance(value, list):
                        cls_list = []
                        for v in value:
                            cls_list.append(attr_type.build_from_dict(v))
                        attributes[a.name] = cls_list
                    else:
                        attributes[a.name] = attr_type.build_from_dict(value)
                elif value and isinstance(attr_type, EnumMeta):
                    try:
                        attributes[a.name] = attr_type[str.upper(value)]
                    except TypeError:
                        # probably already an enum
                        attributes[a.name] = value
                else:
                    attributes[a.name] = value
        try:
            return cls(**attributes)
        except TypeError as err:
            error = err.args[0].replace('__init__()', 'Server request')
            raise Exception(error)

    def to_dict_formatter(self, d: dict):
        """Returns a formatted version of the input dictionary. Default
        function definition simply returns the input without formatting.

        Intended to be used by any attr.s classes that have attribute
        names we want to format before sending to the client, e.g.
        'from_' to 'from'. Used in to_dict.
        """
        return d

    def to_dict(self):
        """Convert an attr.s class into a dict with camel case key values for
        JSON serialization.

        Converts Decimal to str and Enum to the Enum name.

        Recurse is set to true in `attr.asdict` to recurse into classes
        that are also attrs classes.
        """

        return self.to_dict_formatter(attr.asdict(self))


class CamelDictMixin(DictMixin):
    def to_dict(self):
        """Convert an attr.s class into a dict with camel case key values for
        JSON serialization.

        Converts Decimal to str and Enum to the Enum name.

        Recurse is set to true in `attr.asdict` to recurse into classes
        that are also attrs classes.
        """

        return snake_to_camel_dict(self.to_dict_formatter(attr.asdict(self)), {})


class CasePreservedDict(DictMixin):
    items: Dict = {}

    def __init__(self, items=None):
        self.items = items or {}

    def __setitem__(self, k, v) -> None:
        self.items.__setitem__(k, v)

    def __delitem__(self, v) -> None:
        self.items.__delitem__(v)

    def __getitem__(self, k):
        return self.items.__getitem__(k)

    def __len__(self) -> int:
        return self.items.__len__()

    def __iter__(self) -> Iterator:
        return self.items.__iter__()

    def to_dict(self):
        """Convert an attr.s class into a dict with camel case key values for
        JSON serialization.

        Converts Decimal to str and Enum to the Enum name.

        Recurse is set to true in `attr.asdict` to recurse into classes
        that are also attrs classes.
        """

        return self.items


@attr.s(frozen=True)
class FileTransfer:
    model_file: Any = attr.ib()  # actually Response type
    status_code: int = attr.ib(validator=attr.validators.instance_of(int))


def compute_hash(data: dict, **kwargs) -> str:
    """Returns the hash value of args"""
    h = hashlib.new(kwargs.get('alg') or 'sha256')
    to_json = json.dumps(data, sort_keys=True)
    h.update(bytearray(to_json, 'utf-8'))
    hexdigest = h.hexdigest()

    if 'limit' in kwargs:
        return hexdigest[: kwargs['limit']]
    return hexdigest


class AttrDict(dict):
    """Wrap a python dictionary into an object"""

    def __init__(self, *args, **kwargs):
        super(AttrDict, self).__init__(*args, **kwargs)
        self.__dict__ = self

    def to_dict(self, exclude=[], snake_to_camel_transform=False):
        new_dict = {}

        if len(exclude):
            new_dict = {
                key: self.__dict__[key] for key in self.__dict__ if key not in exclude
            }
        else:
            new_dict = self.__dict__

        if snake_to_camel_transform:
            return snake_to_camel_dict(new_dict, {})
        else:
            return new_dict


def filter_dict_by_value(condition, d: dict):
    return {k: v for k, v in d.items() if condition(v)}


def compact(d):
    if isinstance(d, dict):
        return filter_dict_by_value(lambda v: v, d)
    raise NotImplementedError


def equal_number_of_words(term_a: str, term_b: str) -> bool:
    return len(term_a.split(' ')) == len(term_b.split(' '))


class Enumd(Enum):
    @classmethod
    def get(cls, key, default=None):
        # Non-throwing value accessor modeled to behave like dict.get()
        try:
            return cls(key)
        except ValueError:
            return default


def stream_to_json_lines(stream):
    for chunk in stream:
        yield json.dumps(chunk) + '\n'
