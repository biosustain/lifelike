import jwt
from datetime import datetime, timedelta
from flask import current_app, request, Response, json, Blueprint, g
from flask_httpauth import HTTPTokenAuth
from sqlalchemy.orm.exc import NoResultFound

from neo4japp.database import db
from neo4japp.exceptions import (
    InvalidCredentialsException,
    JWTTokenException,
    JWTAuthTokenException,
    RecordNotFoundException,
    NotAuthorizedException,
)
from neo4japp.models.auth import AppUser
from neo4japp.util import generate_jwt_token


bp = Blueprint('auth', __name__, url_prefix='/auth')

auth = HTTPTokenAuth('Bearer')


@auth.verify_token
def verify_token(token):
    """ Verify JTW """
    try:
        decoded = jwt.decode(
            token,
            current_app.config['SECRET_KEY'],
            algorithms=['HS256']
        )
        if decoded['type'] == 'access':
            user = pullUserFromAuthHead()
            g.current_user = user
            current_app.logger.info(f'User login: <{g.current_user.email}>')
            return True
        else:
            raise NotAuthorizedException('no access found')
    except jwt.exceptions.ExpiredSignatureError:
        # Signature has expired
        raise JWTAuthTokenException('auth token has expired')
    except jwt.exceptions.InvalidTokenError:
        raise JWTAuthTokenException('auth token is invalid')


def pullUserFromAuthHead():
    """
        Return user object from jwt in
        auth header of request
    """
    # Pull the JWT
    token = request.headers.get('Authorization')
    token = token.split(' ')[-1].strip()

    email = jwt.decode(
        token,
        current_app.config['SECRET_KEY'],
        algorithms=['HS256']
    )['sub']

    # Pull user by email
    try:
        user = AppUser.query_by_email(email).one()
    except NoResultFound:
        raise RecordNotFoundException('Credentials not found or invalid.')
    return user


@bp.route('/refresh', methods=['POST'])
def refresh():
    """
        Renew access token with refresh token
    """
    data = request.get_json()
    token = data.get('jwt')

    try:
        decoded = jwt.decode(
            token,
            current_app.config['SECRET_KEY'],
            algorithms=['HS256']
        )

        if decoded['type'] != 'refresh':
            # Wrong token type
            return {'status': 'wrong token type submitted'}, 401

        # Create access & refresh token pair
        access_jwt_encoded = generate_jwt_token(
            sub=decoded['sub'],
            secret=current_app.config['SECRET_KEY'],
            token_type='access',
            time_offset=1,
            time_unit='hours',
        )
        refresh_jwt_encoded = generate_jwt_token(
            sub=decoded['sub'],
            secret=current_app.config['SECRET_KEY'],
            token_type='refresh',
            time_offset=1,
            time_unit='days',
        )

        # Create response
        resp = {
            "access_jwt": access_jwt_encoded.decode('utf-8'),
            "refresh_jwt": refresh_jwt_encoded.decode('utf-8')
        }
        return resp, 200
    except jwt.exceptions.ExpiredSignatureError:
        # Signature has expired
        raise JWTTokenException('refresh token has expired')
    except jwt.exceptions.InvalidTokenError:
        # Invalid token
        raise JWTTokenException('refresh token is invalid')


@bp.route('/login', methods=['POST'])
def login():
    """
        Generate JWT to validate graph API calls
        based on successful user login
    """
    data = request.get_json()

    # Pull user by email
    try:
        user = AppUser.query.filter_by(
            email=data.get('email')
        ).one()
    except NoResultFound:
        raise RecordNotFoundException('Credentials not found or invalid.')

    if user.check_password(data.get('password')):

        # Issue access jwt
        access_jwt_encoded = generate_jwt_token(
            sub=user.email,
            secret=current_app.config['SECRET_KEY'],
            token_type='access',
            time_offset=1,
            time_unit='hours',
        )
        # Issue refresh jwt
        refresh_jwt_encoded = generate_jwt_token(
            sub=user.email,
            secret=current_app.config['SECRET_KEY'],
            token_type='refresh',
            time_offset=1,
            time_unit='days',
        )

        # Create response
        resp = {
            'user': user.to_dict(),
            'access_jwt': access_jwt_encoded.decode('utf-8'),
            'refresh_jwt': refresh_jwt_encoded.decode('utf-8')
        }

        return Response(
            response=json.dumps(resp),
            status=200,
            mimetype='application/json'
        )
    else:
        # Complain about invalid credentials
        raise InvalidCredentialsException('Invalid credentials')
