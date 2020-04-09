import jwt
from datetime import datetime, timedelta
from flask import current_app, request, Response, json, Blueprint, g
from flask_httpauth import HTTPTokenAuth
from sqlalchemy.orm.exc import NoResultFound

from neo4japp.database import db
from neo4japp.exceptions import JWTTokenException, RecordNotFoundException, NotAuthorizedException
from neo4japp.models.auth import AppUser

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
            return True
        else:
            raise NotAuthorizedException('no access found')
    except jwt.exceptions.ExpiredSignatureError:
        # Signature has expired
        raise JWTTokenException('refresh token has expired')
    except jwt.exceptions.InvalidTokenError:
        raise JWTTokenException('refresh token is invalid')


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
        access_jwt_encoded = jwt.encode(
            {
                'iat': datetime.utcnow(),
                'sub': decoded['sub'],
                'exp': datetime.utcnow() + timedelta(hours=1),
                'type': 'access'
            },
            current_app.config['SECRET_KEY'],
            algorithm='HS256'
        )
        refresh_jwt_encoded = jwt.encode(
            {
                'iat': datetime.utcnow(),
                'sub': decoded['sub'],
                'exp': datetime.utcnow() + timedelta(days=1),
                'type': 'refresh'
            },
            current_app.config['SECRET_KEY'],
            algorithm='HS256'
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
        access_jwt_encoded = jwt.encode(
            {
                'iat': datetime.utcnow(),
                'sub': user.email,
                'exp': datetime.utcnow() + timedelta(hours=1),
                'type': 'access'
            },
            current_app.config['SECRET_KEY'],
            algorithm='HS256'
        )
        # Issue refresh jwt
        refresh_jwt_encoded = jwt.encode(
            {
                'iat': datetime.utcnow(),
                'sub': user.email,
                'exp': datetime.utcnow() + timedelta(days=1),
                'type': 'refresh'
            },
            current_app.config['SECRET_KEY'],
            algorithm='HS256'
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
        return Response(
            "{'msg':'Invalid credentials', 'status': 'error'}",
            status=401,
            mimetype='application/json'
        )
