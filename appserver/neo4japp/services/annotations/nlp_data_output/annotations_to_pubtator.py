import csv
import json
import os

from neo4japp.database import (
    get_annotations_service,
    get_annotations_pdf_parser,
    get_bioc_document_service,
    get_lmdb_dao,
)
from neo4japp.factory import create_app
from neo4japp.util import compute_hash


# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


def write_to_file(
    annotations,
    pubtator_file,
):
    annotation_json = json.load(annotations)
    identifier = compute_hash(annotation_json, limit=8)
    writer = csv.writer(pubtator_file, delimiter='|', quoting=csv.QUOTE_NONE, escapechar='\\')
    writer.writerow([identifier, 't', annotation_json['documents'][0]['id']])
    writer.writerow([identifier, 'a', annotation_json['documents'][0]['passages'][0]['text']])
    writer = csv.writer(pubtator_file, delimiter='\t')

    annotations = annotation_json['documents'][0]['passages'][0]['annotations']

    for annotation in annotations:
        writer.writerow([
            identifier,
            annotation['loLocationOffset'],
            annotation['hiLocationOffset'],
            annotation['keyword'],
            annotation['meta']['keywordType'],
            annotation['meta']['id'],
        ])


def create_annotations(
    annotations_service,
    bioc_service,
    filename,
    pdf_parser,
    pdf,
):
    parsed = pdf_parser.parse_pdf(pdf=pdf)
    pdf_text_list = pdf_parser.combine_chars_into_words(parsed)
    pdf_text = ' '.join([text for text, _ in pdf_text_list])
    annotations = annotations_service.create_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=parsed),
    )

    bioc = bioc_service.read(text=pdf_text, file_uri=filename)
    bioc_json = bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)
    return bioc_json


def main():
    app = create_app('Functional Test Flask App', config='config.Testing')
    pubtator_file = open(os.path.join(directory, 'pubtator.tsv'), 'w+')
    with app.app_context():
        for parent, subfolders, filenames in os.walk(os.path.join(directory, 'pdfs/')):
            for fn in filenames:
                bioc_service = get_bioc_document_service()
                service = get_annotations_service(lmdb_dao=get_lmdb_dao())
                parser = get_annotations_pdf_parser()

                if fn.lower().endswith('.pdf'):
                    with open(os.path.join(parent, fn), 'rb') as f:
                        annotations = create_annotations(
                            annotations_service=service,
                            bioc_service=bioc_service,
                            filename=fn,
                            pdf_parser=parser,
                            pdf=f,
                        )

                    annotation_file = os.path.join(directory, f'annotations/{fn}.json')
                    with open(annotation_file, 'w+') as a_f:
                        json.dump(annotations, a_f)

        for parent, subfolders, filenames in os.walk(os.path.join(directory, 'annotations/')):
            for fn in filenames:
                with open(os.path.join(parent, fn), 'r') as f:
                    if fn.lower().endswith('.json'):
                        write_to_file(
                            annotations=f,
                            pubtator_file=pubtator_file,
                        )
    pubtator_file.close()


if __name__ == '__main__':
    main()
