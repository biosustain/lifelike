from flask import current_app
from flask_httpauth import HTTPTokenAuth
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from os import environ

from .exceptions import JWTTokenException

auth = HTTPTokenAuth('Bearer')
jwt_client = jwt.PyJWKClient(environ.get('JWKS_URL', ''))

def login_exempt(f):
    """
    Decorator used to specify endpoints that do not require user authentication. For example,
    the /login endpoint.
    """
    f.login_exempt = True
    return f


class TokenService:
    def __init__(self, app_secret: str, algorithm: str = 'HS256'):
        self.app_secret = app_secret
        # See JWT library documentation for available algorithms
        self.algorithm = algorithm

    def _get_key(self, token: str):
        if current_app.config['JWKS_URL'] is not None:
            return jwt_client.get_signing_key_from_jwt(token).key
        elif current_app.config['JWT_SECRET']:
            return current_app.config['JWT_SECRET']
        else:
            raise ValueError("Either JWKS_URL or JWT_SECRET must be set")

    def decode_token(self, token: str, **options):
        try:
            return jwt.decode(
                token,
                key=self._get_key(token),
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
    token_service = TokenService(
        current_app.config['JWT_SECRET'],
        current_app.config['JWT_ALGORITHM']
    )
    token_service.decode_token(token, audience=current_app.config['JWT_AUDIENCE'])
    return True
