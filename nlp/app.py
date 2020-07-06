from flask import Flask, jsonify
from flask_cors import CORS, cross_origin
app = Flask(__name__)
CORS(app, resources={r"*": {"origins": "*"}})

@app.route('/')
def hello():
    return "NLP API v1!"

import os
from flask import Blueprint, request, abort, jsonify
from services.ai_service import AIService
aiservice = AIService()

@app.route('/infer/v1', methods=['POST'])
def ai():
    data = request.get_json()
    text = data['text']
    if text is None:
        return jsonify('text invalid')
    results = aiservice.infer(text)
    return jsonify(results)


if __name__ == '__main__':
    app.run()