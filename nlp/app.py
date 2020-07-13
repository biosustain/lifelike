from flask import Flask, request, jsonify
from flask_cors import CORS
from services.ai_service import AIService

app = Flask(__name__)
CORS(app, resources={r'*': {'origins': '*'}})

aiservice = AIService()


@app.route('/health')
def hello():
    return '200'


@app.route('/infer/v1', methods=['POST'])
def ai():
    data = request.form.to_dict()
    text = data['text']
    if text is None:
        return jsonify('text invalid')
    results = aiservice.infer(text)
    return jsonify(results)
