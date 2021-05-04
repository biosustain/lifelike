import itertools
from decimal import Decimal, InvalidOperation
from enum import Enum
from flask import json
from json import JSONDecodeError


def encode_to_str(obj):
    """Converts different types into a string representation. """
    if isinstance(obj, str):
        return obj
    elif isinstance(obj, Enum):
        return obj.name
    elif isinstance(obj, int) or isinstance(obj, Decimal):
        return str(obj)
    else:
        raise TypeError(f'No conversion definition for {obj}')


def snake_to_camel_dict(d, new_dict: dict) -> dict:
    """Converts a snake_case dict to camelCase while taking into
    consideration a nested list or dict as a value.
    """
    if type(d) is not dict:
        return d
    for k, v in d.items():
        if callable(getattr(v, 'to_dict', None)):
            new_dict.update({snake_to_camel(encode_to_str(k)): v.to_dict()})
        elif type(v) is list:
            new_dict.update({snake_to_camel(encode_to_str(k)): [snake_to_camel_dict(i, {}) for i in v]})  # noqa
        elif type(v) is dict:
            new_dict.update({snake_to_camel(encode_to_str(k)): snake_to_camel_dict(v, {})})  # noqa
        else:
            new_dict.update({snake_to_camel(encode_to_str(k)): v})
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
    if (len(s) == 1):
        return s.lower()

    buf = [s[0].lower()]
    prev_is_uppercase = s[0].isupper()

    # scan from the second char, with one lookahead
    normal, lookahead = itertools.tee(s[1:])
    next(lookahead)

    for (c, ahead) in itertools.zip_longest(normal, lookahead):
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
            new_dict.update({camel_to_snake(k): [camel_to_snake_dict(i, {}) for i in v]})  # noqa
        elif type(v) is dict:
            new_dict.update({camel_to_snake(k): camel_to_snake_dict(v, {})})  # noqa
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
                    new_dict.update({camel_to_snake(k): camel_to_snake_dict(v, {})})  # noqa
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

