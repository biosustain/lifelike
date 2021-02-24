import contextlib
import cProfile
import io
import pstats
import os
import requests
import json

from datetime import datetime

from neo4japp.database import db
from neo4japp.factory import create_app
from neo4japp.models import Files
from neo4japp.services.annotations.constants import AnnotationMethod
from neo4japp.services.annotations.pipeline import create_annotations_from_pdf


# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


@contextlib.contextmanager
def cprofiled():
    """Used to generate cProfile report of function calls.
    """
    pr = cProfile.Profile()
    pr.enable()
    yield
    pr.disable()
    s = io.StringIO()

    try:
        log_path = os.path.join(directory, 'results')
        os.makedirs(log_path)
    except FileExistsError:
        pass
    file_name = f'{log_path}/{datetime.now().isoformat()}-annotations.dmp'
    # ps = pstats.Stats(pr, stream=s).sort_stats('cumulative')
    ps = pstats.Stats(pr, stream=s).dump_stats(file_name)
    # ps.print_stats()
    # uncomment this to see who's calling what
    # ps.print_callers()
    # print(s.getvalue())


def main():
    app = create_app('Functional Test Flask App', config='config.Testing')
    with app.app_context():
        req = requests.post(
            'http://localhost:5000/auth/login',
            data=json.dumps({'email': 'admin@example.com', 'password': 'password'}),
            headers={'Content-type': 'application/json'})

        access_token = json.loads(req.text)['access_jwt']

        pdf = os.path.join(
            directory,
            '../../../../tests/database/services/annotations/pdf_samples/Protein Protein Interactions for Covid.pdf')  # noqa

        hash_id = None
        with open(pdf, 'rb') as f:
            upload_req = requests.post(
                'http://localhost:5000/filesystem/objects',
                headers={'Authorization': f'Bearer {access_token}'},
                files={'contentValue': f},
                data={
                    'filename': 'Protein Protein Interactions for Covid.pdf',
                    'parentHashId': 'lazhauxymcrahybaxcvkathnofyissffuidu'}
            )

            hash_id = json.loads(upload_req.text)['result']['hashId']

        f = db.session.query(Files).filter(Files.hash_id == hash_id).one()
        with cprofiled():
            annotations = create_annotations_from_pdf(
                AnnotationMethod.RULES.value, '', '', f, f.filename)


if __name__ == '__main__':
    main()
