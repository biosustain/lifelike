import os
from flask import render_template
from neo4japp.factory import create_app

app_config = os.environ['FLASK_APP_CONFIG']
app = create_app(config=f'config.{app_config}')

@app.route('/')
def home():
    return render_template('index.html')