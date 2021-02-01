import jwt
import sentry_sdk
from datetime import datetime, timedelta
from flask import current_app, request, Blueprint, g, jsonify
from flask_httpauth import HTTPTokenAuth
from sqlalchemy.orm.exc import NoResultFound
from typing_extensions import TypedDict
from neo4japp.exceptions import (
    InvalidCredentialsException,
    JWTTokenException,
    JWTAuthTokenException,
    RecordNotFoundException,
    NotAuthorizedException,
)
from neo4japp.schemas.auth import JWTTokenResponse
from neo4japp.models.auth import AppUser
from neo4japp.utils.logger import UserEventLog


bp = Blueprint('auth', __name__, url_prefix='/auth')

auth = HTTPTokenAuth('Bearer')


JWTToken = TypedDict(
    'JWTToken', {'sub': str, 'iat': datetime, 'exp': datetime, 'token_type': str, 'token': str})

JWTResp = TypedDict(
    'JWTResp', {'sub': str, 'iat': str, 'exp': int, 'type': str})


class TokenService:

    def __init__(self, app_secret: str, algorithm: str = 'HS256'):
        self.app_secret = app_secret
        # See JWT library documentation for available algorithms
        self.algorithm = algorithm

    def _generate_jwt_token(
            self,
            sub: str,
            secret: str,
            token_type: str = 'access',
            time_offset: int = 1,
            time_unit: str = 'hours',
    ) -> JWTToken:
        """
        Generates an authentication or refresh JWT Token

        Args:
            sub - the subject of the token (e.g. user email)
            secret - secret that should not be shared for encryption
            token_type - one of 'access' or 'refresh'
            time_offset - the difference in time before token expiration
            time_unit - time offset for expiration (days, hours, etc) (see datetime docs)
        """
        time_now = datetime.utcnow()
        expiration = time_now + timedelta(**{time_unit: time_offset})
        token = jwt.encode({
            'iat': time_now,
            'sub': sub,
            'exp': expiration,
            'type': token_type,
        }, secret, algorithm=self.algorithm).decode('utf-8')
        return {
            'sub': sub,
            'iat': time_now,
            'exp': expiration,
            'token_type': token_type,
            'token': token
        }

    def get_access_token(
            self, subj, token_type='access', time_offset=10, time_unit='seconds') -> JWTToken:
        return self._generate_jwt_token(
            sub=subj, secret=self.app_secret, token_type=token_type,
            time_offset=time_offset, time_unit=time_unit)

    def get_refresh_token(
            self, subj, token_type='refresh', time_offset=60, time_unit='days') -> JWTToken:
        return self._generate_jwt_token(
            sub=subj, secret=self.app_secret, token_type=token_type,
            time_offset=time_offset, time_unit=time_unit)

    def decode_token(self, token: str) -> JWTResp:
        try:
            payload = jwt.decode(token, self.app_secret, algorithms=[self.algorithm])
            jwt_resp: JWTResp = {
                'sub': payload['sub'], 'iat': payload['iat'], 'exp': payload['exp'],
                'type': payload['type']}
        except jwt.exceptions.InvalidTokenError:  # type: ignore
            raise JWTTokenException('auth token is invalid')
        except jwt.exceptions.ExpiredSignatureError:  # type: ignore
            raise JWTTokenException('auth token is expired')
        else:
            return jwt_resp


@auth.verify_token
def verify_token(token):
    """ Verify JTW """
    token_service = TokenService(current_app.config['SECRET_KEY'])
    decoded = token_service.decode_token(token)
    if decoded['type'] == 'access':
        token = request.headers.get('Authorization')
        if token is None:
            raise JWTAuthTokenException('No authorization header found.')
        else:
            token = token.split(' ')[-1].strip()
            try:
                user = AppUser.query_by_email(decoded['sub']).one()
            except NoResultFound:
                raise RecordNotFoundException('Credentials not found.')
            else:
                g.current_user = user
                with sentry_sdk.configure_scope() as scope:
                    scope.set_tag('user_email', user.email)
                return True
    else:
        raise NotAuthorizedException('no access found')


@bp.route('/refresh', methods=['POST'])
def refresh():
    """ Renew access token with refresh token """
    data = request.get_json()
    token = data.get('jwt')
    token_service = TokenService(current_app.config['SECRET_KEY'])

    decoded = token_service.decode_token(token)
    if decoded['type'] != 'refresh':
        raise JWTTokenException('wrong token type submitted')

    # Create access & refresh token pair
    token_subj = decoded['sub']
    access_jwt = token_service.get_access_token(token_subj)
    refresh_jwt = token_service.get_refresh_token(token_subj)

    try:
        user = AppUser.query.filter_by(email=decoded['sub']).one()
    except NoResultFound:
        raise RecordNotFoundException('Credentials not found.')
    else:
        return jsonify(JWTTokenResponse().dump({
            'access_token': access_jwt,
            'refresh_token': refresh_jwt,
            'user': user,
        }))


@bp.route('/login', methods=['POST'])
def login():
    """
        Generate JWT to validate graph API calls
        based on successful user login
    """
    data = request.get_json()

    # Pull user by email
    try:
        user = AppUser.query.filter_by(email=data.get('email')).one()
    except NoResultFound:
        raise RecordNotFoundException('Credentials not found or invalid.')
    else:
        if user.check_password(data.get('password')):
            current_app.logger.info(
                UserEventLog(username=user.username, event_type='user login').to_dict())
            token_service = TokenService(current_app.config['SECRET_KEY'])
            access_jwt = token_service.get_access_token(user.email)
            refresh_jwt = token_service.get_refresh_token(user.email)
            return jsonify(JWTTokenResponse().dump({
                'access_token': access_jwt,
                'refresh_token': refresh_jwt,
                'user': user,
            }))
        else:
            # Complain about invalid credentials
            raise InvalidCredentialsException('Invalid credentials')
