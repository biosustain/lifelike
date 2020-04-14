import pytest
import jwt

from decimal import Decimal
from enum import Enum

from neo4japp.util import (
    camel_to_snake,
    camel_to_snake_dict,
    encode_to_str,
    generate_jwt_token,
)


@pytest.mark.parametrize("camel_input, expected_snake_output", [
    ('', ''),
    ('A', 'a'),
    ('AB', 'ab'),
    ('Ab', 'ab'),
    ('aB', 'a_b'),
    ('ab', 'ab'),
    ("Camel", "camel"),
    ("CamelCase", "camel_case"),
    ("Camel2", "camel2"),
    ("Camel2Case", "camel2_case"),
    ("getHttpResponse", "get_http_response"),
    ("HTTPResponseCode", "http_response_code"),
    ("HTTPResponseCodeXYZ", "http_response_code_xyz"),
    ("SnakesOnAPlane", "snakes_on_a_plane")
])
def test_camel_to_snake(camel_input, expected_snake_output):
    assert camel_to_snake(camel_input) == expected_snake_output


@pytest.mark.parametrize("camel_input, expected_snake_output", [
    ({'testData1': 'hello'}, {'test_data1': 'hello'}),
    ({'testData1': 'hello', 'testData2': 'hi'}, {'test_data1': 'hello', 'test_data2': 'hi'}),  # noqa
    ({'superLongCamelCaseName': ['hi']}, {'super_long_camel_case_name': ['hi']}),  # noqa
    ({'nested': [{'test': 'hello'}]}, {'nested': [{'test': 'hello'}]}),
    ({'camelCase': {'camelCase': {'camelCase': 'val'}}}, {'camel_case': {'camel_case': {'camel_case': 'val'}}})  # noqa
])
def test_camel_to_snake_dict(camel_input, expected_snake_output):
    assert camel_to_snake_dict(camel_input, {}) == expected_snake_output


class MockEnum(Enum):
    PROPERTY1 = 'Property1'


@pytest.mark.parametrize('data_input, expected_output', [
    ('str', 'str'),
    (MockEnum.PROPERTY1, 'PROPERTY1'),
    (Decimal('1.123'), '1.123')
])
def test_can_encode_to_str(data_input, expected_output):
    assert encode_to_str(data_input) == expected_output


@pytest.mark.parametrize('subject, secret, token_type, time_offset, time_unit, algorithm', [
    ('user@gmail.com', 'secret', 'access', 1, 'days', 'HS256'),
    ('user@gmail.com', 'secret', 'refresh', 0, 'days', 'HS384'),
    ('user@gmail.com', 'secret', 'access', 10, 'days', 'HS256'),
    ('user@gmail.com', 'secret', 'access', 1, 'hours', 'HS256'),
    ('user@gmail.com', 'secret', 'access', 5, 'hours', 'HS256'),
    ('user@gmail.com', 'secret', 'access', 5.2, 'hours', 'HS256'),
])
def test_can_generate_and_decrypt_jwt_tokens(
        subject, secret, token_type, time_offset, time_unit, algorithm):
    jwt_token = generate_jwt_token(
        subject, secret, token_type, time_offset, time_unit, algorithm)
    decoded_jwt = jwt.decode(jwt_token, secret, algorithms=[algorithm])

    assert decoded_jwt.get('sub') == subject
    assert decoded_jwt.get('type') == token_type

    exp_time = decoded_jwt.get('exp')
    issued_time = decoded_jwt.get('iat')

    if time_unit == 'days':
        assert ((((exp_time - issued_time)/60)/60)/24) == time_offset
    else:
        assert ((((exp_time - issued_time)/60)/60)) == time_offset
