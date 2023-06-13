import functools
from typing import Optional, Type

from flask import jsonify, request

from neo4japp.schemas.common import SuccessResponse
from neo4japp.util import camel_to_snake_dict, CamelDictMixin


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
                        request_data['file_input'] = request.files.get('fileInput')
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
                elif isinstance(result, list):
                    for index, _ in enumerate(result):
                        if isinstance(result[index], CamelDictMixin):
                            result[index] = result[index].to_dict()

                return (
                    jsonify({'result': result}),
                    success_object.status_code,
                )
            elif isinstance(success_object, dict):
                return jsonify(success_object)
            else:
                return success_object.model_file, success_object.status_code

        return decorator

    return converter
