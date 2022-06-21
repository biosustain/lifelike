import jwt
import sentry_sdk

from datetime import datetime, timedelta, timezone
from flask import current_app, request, Blueprint, g, jsonify
from flask_httpauth import HTTPTokenAuth
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.exc import NoResultFound
from typing_extensions import TypedDict

from neo4japp.database import db, jwt_client
from neo4japp.constants import LogEventType, MAX_ALLOWED_LOGIN_FAILURES
from neo4japp.exceptions import (
    JWTTokenException,
    ServerException,
)
from neo4japp.schemas.auth import LifelikeJWTTokenResponse
from neo4japp.models.auth import AppRole, AppUser
from neo4japp.utils.logger import UserEventLog


bp = Blueprint('auth', __name__, url_prefix='/auth')

auth = HTTPTokenAuth('Bearer')

JWTToken = TypedDict(
    'JWTToken', {'sub': str, 'iat': datetime, 'exp': datetime, 'token_type': str, 'token': str})

JWTResp = TypedDict(
    'JWTResp', {'sub': str, 'iat': str, 'exp': int, 'typ': str})


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

    def _generate_jwt_token(
            self,
            sub: str,
            secret: str,
            token_type: str = 'access',
            # TODO: Maybe we should make these environment variables?
            time_offset: int = 30,
            time_unit: str = 'minutes',
    ) -> JWTToken:
        """
        Generates an authentication or refresh JWT Token

        Args:
            sub - the subject of the token (e.g. user email, hash id, or 3rd-party subject)
            secret - secret that should not be shared for encryption
            token_type - one of 'access' or 'refresh'
            time_offset - the difference in time before token expiration
            time_unit - time offset for expiration (days, hours, etc) (see datetime docs)
        """
        time_now = datetime.now(timezone.utc)
        expiration = time_now + timedelta(**{time_unit: time_offset})
        token = jwt.encode({
            'iat': time_now,
            'sub': sub,
            'exp': expiration,
            'typ': token_type,
        }, secret, algorithm=self.algorithm)
        return {
            'sub': sub,
            'iat': time_now,
            'exp': expiration,
            'token_type': token_type,
            'token': token
        }

    def _get_key(self, token: str):
        if current_app.config['JWKS_URL'] is not None:
            return jwt_client.get_signing_key_from_jwt(token).key
        elif current_app.config['JWT_SECRET']:
            return current_app.config['JWT_SECRET']
        else:
            raise ValueError("Either JWKS_URL or JWT_SECRET must be set")

    def get_access_token(
        self,
        subj,
        token_type='access',
        # TODO: Maybe we should make these environment variables?
        time_offset=30,
        time_unit='minutes'
    ) -> JWTToken:
        return self._generate_jwt_token(
            sub=subj, secret=self.app_secret, token_type=token_type,
            time_offset=time_offset, time_unit=time_unit)

    def get_refresh_token(
        self,
        subj,
        token_type='refresh',
        # TODO: Maybe we should make these environment variables?
        time_offset=7,
        time_unit='days'
    ) -> JWTToken:
        return self._generate_jwt_token(
            sub=subj, secret=self.app_secret, token_type=token_type,
            time_offset=time_offset, time_unit=time_unit)

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
    """ Verify JTW """
    token_service = TokenService(
        current_app.config['JWT_SECRET'],
        current_app.config['JWT_ALGORITHM']
    )
    decoded = token_service.decode_token(token, audience=current_app.config['JWT_AUDIENCE'])

    try:
        user = AppUser.query_by_subject(decoded['sub']).one()
        current_app.logger.info(
            f'Active user: {user.email}',
            extra=UserEventLog(
                username=user.username,
                event_type=LogEventType.LAST_ACTIVE.value).to_dict()
        )
    except NoResultFound:
        # Note that this except block should only trigger when a user signs in via OAuth for the
        # first time.
        user = AppUser(
            username=decoded['username'],
            email=decoded['email'],
            first_name=decoded['first_name'],
            last_name=decoded['last_name'],
            subject=decoded['sub']
        )

        # Add the "user" role to the new user
        user_role = AppRole.query.filter_by(name='user').one()
        user.roles.append(user_role)

        # Finally, add the new user to the DB
        try:
            db.session.add(user)
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
            raise

    g.current_user = user
    with sentry_sdk.configure_scope() as scope:
        scope.set_tag('user_email', user.email)
    return True


@bp.route('/refresh', methods=['POST'])
@login_exempt
def refresh():
    """ Renew access token with refresh token """
    data = request.get_json()
    token = data.get('jwt')
    token_service = TokenService(
        current_app.config['JWT_SECRET'],
        current_app.config['JWT_ALGORITHM']
    )

    decoded = token_service.decode_token(token)
    if decoded['typ'] != 'refresh':
        raise JWTTokenException(
            message='Your authentication session expired, but there was an error attempting to renew it.')  # noqa

    # Create access & refresh token pair
    token_subj = decoded['sub']
    access_jwt = token_service.get_access_token(token_subj)
    refresh_jwt = token_service.get_refresh_token(token_subj)

    try:
        user = AppUser.query_by_subject(decoded['sub']).one()
    except NoResultFound:
        raise ServerException(
            title='Failed to Authenticate',
            message='There was a problem authenticating, please try again.',
            code=404)
    else:
        return jsonify(LifelikeJWTTokenResponse().dump({
            'access_token': access_jwt,
            'refresh_token': refresh_jwt,
            'user': {
                'hash_id': user.hash_id,
                'email': user.email,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'id': user.id,
                'roles': [u.name for u in user.roles],
            },
        }))


@bp.route('/login', methods=['POST'])
@login_exempt
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
        raise ServerException(
            title='Failed to Authenticate',
            message='Could not find an account with that username/password combination. Please ' +
                    'try again.',
            code=404)
    else:
        if user.failed_login_count >= MAX_ALLOWED_LOGIN_FAILURES:
            raise ServerException(
                title='Failed to Login',
                message='The account has been suspended after too many failed login attempts.\
                Please contact an administrator for help.',
                code=423)
        elif user.check_password(data.get('password')):
            current_app.logger.info(
                UserEventLog(
                    username=user.username,
                    event_type=LogEventType.AUTHENTICATION.value).to_dict())
            token_service = TokenService(
                current_app.config['JWT_SECRET'],
                current_app.config['JWT_ALGORITHM']
            )
            access_jwt = token_service.get_access_token(user.email)
            refresh_jwt = token_service.get_refresh_token(user.email)
            user.failed_login_count = 0
            return jsonify(LifelikeJWTTokenResponse().dump({
                'access_token': access_jwt,
                'refresh_token': refresh_jwt,
                'user': {
                    'hash_id': user.hash_id,
                    'email': user.email,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'id': user.id,
                    'reset_password': user.forced_password_reset,
                    'roles': [u.name for u in user.roles],
                },
            }))
        else:
            user.failed_login_count += 1
            try:
                db.session.add(user)
                db.session.commit()
            except SQLAlchemyError:
                db.session.rollback()
                raise

            raise ServerException(
                title='Failed to Authenticate',
                message='Could not find an account with that username/password combination. ' +
                        'Please try again.',
                code=404)
