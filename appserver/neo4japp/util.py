import attr
import functools
import hashlib
import itertools
import jwt

from decimal import Decimal, InvalidOperation
from enum import EnumMeta
from json import JSONDecodeError
from typing import Any, List, Optional, Type

from flask import json, jsonify, request, current_app
from flask_httpauth import HTTPTokenAuth

from neo4japp.models.drawing_tool import AppUser

auth = HTTPTokenAuth(scheme='Token')

@auth.verify_token
def verify_token(token):
    """
        Verify JWT
    """
    try:
        decoded = jwt.decode(
            token,
            current_app.config['SECRET_KEY'],
            algorithms=['HS256']
        )
        if decoded['type'] == 'access':
            return True
        else:
            return False
    except jwt.exceptions.ExpiredSignatureError:
        # Signature has expired
        return False
    except jwt.exceptions.InvalidTokenError:
        return False


def pullUserFromAuthHead():
    """
        Return user object from jwt in
        auth header of request
    """
    # Pull the JWT
    token = request.headers.get('Authorization')
    token = token.replace("Token ", "")

    # Decode it to email
    email = jwt.decode(
        token,
        current_app.config['SECRET_KEY'],
        algorithms='HS256'
    )['sub']

    # Pull user by email
    user = AppUser.query.filter_by(email=email).first_or_404()

    return user

def encode_to_str(obj):
    """Converts different types into a string representation. """
    if isinstance(obj, str):
        return obj
    elif isinstance(obj, Enum):
        return obj.name
    elif isinstance(obj, Decimal):
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
        if type(v) is list:
            new_dict.update({snake_to_camel(encode_to_str(k)): [snake_to_camel_dict(i, {}) for i in v]})  # noqa
        elif type(v) is dict:
            new_dict.update({snake_to_camel(encode_to_str(k)): snake_to_camel_dict(v, {})})  # noqa
        else:
            new_dict.update({snake_to_camel(encode_to_str(k)): v})
    return new_dict


def snake_to_camel(s):
    if not s:
        return s
    parts = s.split('_')
    return parts[0] + ''.join(x.capitalize() or '_' for x in parts[1:])


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
                new_dict.update({camel_to_snake(k): camel_to_snake_dict(v, {})})  # noqa
            except JSONDecodeError:
                # not a string representation of dictionary or number type
                new_dict.update({camel_to_snake(k): v})
        else:
            # for booleans, etc
            new_dict.update({camel_to_snake(k): v})
    return new_dict


class CamelDictMixin:
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
                if (value and
                   issubclass(attr_type, CamelDictMixin)):
                    # assumption is if attr_type is a subclass
                    # then value must be type dict
                    if isinstance(value, list):
                        cls_list = []
                        for v in value:
                            cls_list.append(attr_type.build_from_dict(v))
                        attributes[a.name] = cls_list
                    else:
                        attributes[a.name] = attr_type.build_from_dict(value)
                elif (value and
                      isinstance(attr_type, EnumMeta)):
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

    def to_dict(self):
        """Convert an attr.s class into a dict with camel case key values for
        JSON serialization.

        Converts Decimal to str and Enum to the Enum name.

        Recurse is set to true in `attr.asdict` to recurse into classes
        that are also attrs classes.
        """

        return snake_to_camel_dict(attr.asdict(self), {})


@attr.s(frozen=True)
class SuccessResponse(CamelDictMixin):
    result: Any = attr.ib()  # Union[ReconBase, CamelDictMixin, List[Union[ReconBase, CamelDictMixin]], str, bool]  # noqa
    status_code: int = attr.ib(validator=attr.validators.instance_of(int))


@attr.s(frozen=True)
class FileTransfer():
    model_file: Any = attr.ib()  # actually Response type
    status_code: int = attr.ib(validator=attr.validators.instance_of(int))


def jsonify_with_class(
        request_class: Optional[Type[CamelDictMixin]] = None,
        has_file: bool = False,
):
    """Returns a conversion decorator.

    For use by flask blueprints to map client request to
    a data model, and return server response as JSON.

    This decorator must be passed the model class it is expected
    to map the client request data to.

    Raises IllegalArgumentException if the request does not have the
    correct attribute field.
    """
    def converter(f):
        @functools.wraps(f)
        def decorator(*args, **kwargs):
            request_data = None
            request_object = None
            success_object = None

            if request_class:
                try:
                    # assumes file upload will always be used
                    # with `request.form`
                    # as our only file upload related implementation
                    # uses `request.form`
                    if has_file:
                        request_data = request.form.to_dict()
                        request_data['file_input'] = request.files.get('fileInput')  # noqa
                    else:
                        # set to silent to return as None if empty
                        request_data = request.get_json(silent=True)
                        if request_data is None:
                            request_data = request.args.to_dict()

                    if request_data:
                        request_object = request_class.build_from_dict(
                            camel_to_snake_dict(request_data, new_dict={})
                        )
                    else:
                        request_object = request_class()
                except TypeError as err:
                    error = err.args[0].replace('__init__()', 'Server request')
                    raise Exception(error)
                success_object = f(request_object, *args, **kwargs)
            else:
                success_object = f(*args, **kwargs)

            if isinstance(success_object, SuccessResponse):
                # check type of success object to determine how to get
                # the actual data it holds
                result = success_object.result
                if isinstance(result, CamelDictMixin):
                    result = result.to_dict()
                elif (isinstance(result, list)):
                    for index, _ in enumerate(result):
                        if isinstance(result[index], CamelDictMixin):
                            result[index] = result[index].to_dict()  # noqa

                return (
                    jsonify({'result': result}),
                    success_object.status_code,
                )
            else:
                return success_object.model_file, success_object.status_code
        return decorator
    return converter


def compute_hash(data: dict, **kwargs) -> str:
    """Returns the hash value of args"""
    h = hashlib.new(kwargs.get('alg') or 'sha256')
    to_json = json.dumps(data, sort_keys=True)
    h.update(bytearray(to_json, 'utf-8'))
    hexdigest = h.hexdigest()

    if 'limit' in kwargs:
        return hexdigest[:kwargs['limit']]
    return hexdigest
