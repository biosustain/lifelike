import io
import os
import json
import multiprocessing as mp

import requests

from neo4japp.database import db
from neo4japp.factory import create_app
from neo4japp.models import Files
from neo4japp.services.annotations.constants import AnnotationMethod
from neo4japp.services.annotations.pipeline import create_annotations_from_pdf


# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


def main():
    app = create_app('Functional Test Flask App', config='config.QA')

    with app.app_context():
        req = requests.post(
            'http://localhost:5000/auth/login',
            data=json.dumps({'email': 'admin@example.com', 'password': 'password'}),
            headers={'Content-type': 'application/json'})

        access_token = json.loads(req.text)['access_jwt']

        hash_ids = set()

        for parent, subfolders, filenames in os.walk(os.path.join(directory, 'pdfs/')):
            for fn in filenames:
                if fn.lower().endswith('.pdf'):
                    with open(os.path.join(parent, fn), 'rb') as f:
                        upload_req = requests.post(
                            'http://localhost:5000/filesystem/objects',
                            headers={'Authorization': f'Bearer {access_token}'},
                            files={'contentValue': f},
                            data={
                                'filename': fn,
                                'parentHashId': 'lazhauxymcrahybaxcvkathnofyissffuidu'}
                        )
                        hash_ids.add(json.loads(upload_req.text)['result']['hashId'])

        files = db.session.query(Files).filter(Files.hash_id.in_(hash_ids)).all()

        annotations_list = []
        failed = set()
        for f in files:
            try:
                annotations = create_annotations_from_pdf(
                    AnnotationMethod.RULES.value, '', '', f, f.filename)
                annotations_list.append(
                    (f.filename,
                    annotations['documents'][0]['passages'][0]['text'],  # noqa
                    annotations['documents'][0]['passages'][0]['annotations']))  # noqa
            except Exception:
                try:
                    annotations = create_annotations_from_pdf(
                        AnnotationMethod.RULES.value, '', '', f, f.filename)
                    annotations_list.append(
                        (f.filename,
                        annotations['documents'][0]['passages'][0]['text'],  # noqa
                        annotations['documents'][0]['passages'][0]['annotations']))  # noqa
                except Exception:
                    failed.add(f.filename)

        print(failed)

        identifier = '1234567'
        for (filename, text, annos) in annotations_list:
            with open(os.path.join(directory, f'{filename}.txt'), 'w') as f:
                mem_file = io.StringIO()
                print(f'{identifier}|t|{filename}', file=mem_file)
                print(f'{identifier}|t|{text}', file=mem_file)

                for anno in annos:
                    lo_offset = anno['loLocationOffset']
                    hi_offset = anno['hiLocationOffset']
                    keyword = anno['textInDocument']
                    keyword_type = anno['meta']['type']
                    id = anno['meta']['id']

                    print(
                        f'{identifier}\t{lo_offset}\t{hi_offset}\t{keyword}\t{keyword_type}\t{id}',
                        file=mem_file,
                    )

                print(mem_file.getvalue(), file=f)


if __name__ == '__main__':
    main()
