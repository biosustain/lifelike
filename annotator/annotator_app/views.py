from .app import app

@app.route('/', methods=['GET','POST'])
def enrich():
    raise Exception('No function provided!')

@app.route('/healthz', methods=['GET','POST'])
def healthz():
    return "I am OK!"

@app.route('/annotate', methods=['GET'])
def annotate():
    annotate_files()
