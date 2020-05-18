import csv
import json
import os

from neo4japp.database import (
    get_annotations_service,
    get_annotations_pdf_parser,
    get_lmdb_dao,
)
from neo4japp.factory import create_app
from neo4japp.util import compute_hash


# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


def write_to_file(
    annotations_service,
    pdf_parser,
    pdf,
    pubtator_file,
):
    pdf_json = json.load(pdf)
    identifier = compute_hash(pdf_json, limit=8)
    writer = csv.writer(pubtator_file, delimiter='|')
    writer.writerow([identifier, 't', pdf_json['documents'][0]['id']])
    writer.writerow([identifier, 'a', repr(pdf_json['documents'][0]['passages'][0]['text'])])
    writer = csv.writer(pubtator_file, delimiter='\t')

    annotations = pdf_json['documents'][0]['passages'][0]['annotations']

    for annotation in annotations:
        writer.writerow([
            identifier,
            annotation['loLocationOffset'],
            annotation['hiLocationOffset'],
            annotation['keyword'],
            annotation['meta']['idType'],
            annotation['meta']['id'],
        ])


def main():
    app = create_app('Functional Test Flask App', config='config.Testing')
    pubtator_file = open(os.path.join(directory, 'pubtator.tsv'), 'w+')
    with app.app_context():
        service = get_annotations_service(lmdb_dao=get_lmdb_dao())
        parser = get_annotations_pdf_parser()

        for parent, subfolders, filenames in os.walk(os.path.join(directory, 'annotations/')):
            for fn in filenames:
                with open(os.path.join(parent, fn), 'rb') as f:
                    write_to_file(
                        annotations_service=service,
                        pdf_parser=parser,
                        pdf=f,
                        pubtator_file=pubtator_file,
                    )
    pubtator_file.close()


if __name__ == '__main__':
    main()
