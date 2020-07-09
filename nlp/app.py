import os
from flask import Flask, Blueprint, abort, request, jsonify
from flask_cors import CORS, cross_origin
from services.ai_service import AIService

app = Flask(__name__)
CORS(app, resources={r"*": {"origins": "*"}})

aiservice = AIService()


@app.route('/health')
def hello():
    return "200"


@app.route('/infer/v1', methods=['POST'])
def ai():
    data = request.get_json()
    text = data['text']
    if text is None:
        return jsonify('text invalid')
    results = aiservice.infer(text)
    return jsonify(results)
