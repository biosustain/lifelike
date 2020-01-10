from flask import Blueprint, jsonify, request

bp = Blueprint('example', __name__, url_prefix='/example')

@bp.route('/')
def home_example():
    return 'home example'