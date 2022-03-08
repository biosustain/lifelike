from datetime import datetime
from flask import current_app, request
from flask_httpauth import HTTPTokenAuth
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from typing_extensions import TypedDict

from .exceptions import (
    JWTTokenException,
    JWTAuthTokenException,
    ServerException,
)


auth = HTTPTokenAuth('Bearer')


def login_exempt(f):
    """
    Decorator used to specify endpoints that do not require user authentication. For example,
    the /login endpoint.
    """
    f.login_exempt = True
    return f


def _get_key(token: str):
    if current_app.config['JWKS_URL'] is not None:
        client = jwt.PyJWKClient(current_app.config['JWKS_URL'])
        return client.get_signing_key_from_jwt(token).key
    elif current_app.config['JWT_SECRET']:
        return current_app.config['JWT_SECRET']
    else:
        raise ValueError("Either JWKS_URL or JWT_SECRET must be set")

def _decode_token(self, token: str, **options):
    try:
        return jwt.decode(
            token,
            key=_get_key(token),
            algorithms=[self.algorithm],
            **options
        )
    # default to generic error message
    # NOTE: is this better than avoiding to
    # display an error message about
    # authorization header (for security purposes)?
    except InvalidTokenError:
        raise JWTTokenException(
            title='Failed to Authenticate',
            message='The current authentication session is invalid, please try logging back in.')  # noqa
    except ExpiredSignatureError:
        raise JWTTokenException(
            title='Failed to Authenticate',
            message='The current authentication session has expired, please try logging back in.')  # noqa


@auth.verify_token
def verify_token(token):
    """ Verify JWT """
    decoded = _decode_token(token)
    if decoded['type'] == 'access':
        token = request.headers.get('Authorization')
        if token is None:
            raise JWTAuthTokenException(
                title='Failed to Authenticate',
                message='There was a problem verifying the authentication session, please try again.')  # noqa
    else:
        raise ServerException(
            title='Failed to Authenticate',
            message='There was a problem authenticating, please try again.')
    return True
