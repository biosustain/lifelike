from flask import Flask
from flask_cors import CORS, cross_origin
app = Flask(__name__)
CORS(app, resources={r"*": {"origins": "*"}})

@app.route('/')
def hello():
    return "NLP API v1!"

import os
from flask import Blueprint, request, abort, jsonify

@app.route('/get_annotation/ai', methods=['POST'])
def ai():
    return 'this is ai service'


if __name__ == '__main__':
    app.run()