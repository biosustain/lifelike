from datetime import datetime, timedelta
from flask import current_app, request, Response, json, Blueprint
import jwt

from neo4japp.database import db
from neo4japp.models.drawing_tool import AppUser

bp = Blueprint('login', __name__, url_prefix='/auth')


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
        return {'status': 'refresh token has expired'}, 401
    except jwt.exceptions.InvalidTokenError:
        # Invalid token
        return {'status': 'refresh token is invalid'}, 401


@bp.route('/login', methods=['POST'])
def login():
    """
        Generate JWT to validate graph API calls
        based on successful user login
    """
    data = request.get_json()

    user = AppUser.query.filter_by(
        email=data.get('email_addr')
    ).first_or_404()

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
            "access_jwt": access_jwt_encoded.decode('utf-8'),
            "refresh_jwt": refresh_jwt_encoded.decode('utf-8')
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