import attr
import hashlib
import json
import os
import time

from neo4japp.database import (
    get_annotations_service,
    get_annotations_pdf_parser,
    get_bioc_document_service,
    get_lmdb_dao,
)
from neo4japp.factory import create_app
from neo4japp.services.annotations.constants import EntityType, OrganismCategory
from neo4japp.util import compute_hash


# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))
compute_hash = hashlib.sha256()


@attr.s(frozen=True)
class NLPAnnotations():
    filename: str = attr.ib()
    text: str = attr.ib()
    annotations: List[Annotation] = attr.ib()


def write_to_file(
    annotations,
    chemical_pubtator,
    gene_pubtator,
    disease_pubtator,
    species_pubtator,
):
    compute_hash.update(str(time.time()).encode('utf-8'))
    identifier = int(compute_hash.hexdigest(), 16) % 10**8
    title = annotations.filename

    title_length = len(title)
    if title_length < 48:
        i = title_length
        while i < 48:
            title += '.'
            i += 1
        # title_length = len(title)
        # print(f'title was less than 48, now it is {title_length}')
    elif title_length > 48:
        title = title[:48]
        # title_length = len(title)
        # print(f'title was greater than 48, now it is {title_length}')

    text = annotations.text

    for f in [chemical_pubtator, gene_pubtator, disease_pubtator, species_pubtator]:
        print(f'{identifier}|t|{title}', file=f)
        print(f'{identifier}|a|{text}', file=f)

    for annotation in annotations.annotations:
        lo_offset = annotation.lo_location_offset + 49  # (title length + 1)
        hi_offset = annotation.hi_location_offset + 49
        keyword = annotations.annotations_text_in_document
        keyword_type = annotation.meta.keyword_type
        id = annotation.meta.id

        if keyword_type == EntityType.Chemical.value:
            print(
                f'{identifier}\t{lo_offset}\t{hi_offset}\t{keyword}\t{keyword_type}\t{id}',
                file=chemical_pubtator,
            )
        elif keyword_type == EntityType.Gene.value:
            print(
                f'{identifier}\t{lo_offset}\t{hi_offset}\t{keyword}\t{keyword_type}\t{id}',
                file=gene_pubtator,
            )
        elif keyword_type == EntityType.Disease.value:
            print(
                f'{identifier}\t{lo_offset}\t{hi_offset}\t{keyword}\t{keyword_type}\t{id}',
                file=disease_pubtator,
            )
        elif keyword_type == EntityType.Species.value:
            # only Bacteria for now
            if annotation.meta.category == OrganismCategory.Bacteria.value:
                print(
                    f'{identifier}\t{lo_offset}\t{hi_offset}\t{keyword}\t{keyword_type}\t{id}',
                    file=species_pubtator,
                )

    for f in [chemical_pubtator, gene_pubtator, disease_pubtator, species_pubtator]:
        print('', file=f)


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
    return NLPAnnotations(
        filename=filename,
        text=pdf_text,
        annotations=annotations,
    ), bioc_json


def main():
    app = create_app('Functional Test Flask App', config='config.Testing')
    chemical_pubtator = open(os.path.join(directory, 'chemical_pubtator.txt'), 'w+')
    gene_pubtator = open(os.path.join(directory, 'gene_pubtator.txt'), 'w+')
    disease_pubtator = open(os.path.join(directory, 'disease_pubtator.txt'), 'w+')
    species_pubtator = open(os.path.join(directory, 'species_pubtator.txt'), 'w+')

    with app.app_context():
        for parent, subfolders, filenames in os.walk(os.path.join(directory, 'pdfs/')):
            for fn in filenames:
                bioc_service = get_bioc_document_service()
                service = get_annotations_service(lmdb_dao=get_lmdb_dao())
                parser = get_annotations_pdf_parser()

                if fn.lower().endswith('.pdf'):
                    with open(os.path.join(parent, fn), 'rb') as f:
                        try:
                            annotations, bioc_json = create_annotations(
                                annotations_service=service,
                                bioc_service=bioc_service,
                                filename=fn,
                                pdf_parser=parser,
                                pdf=f,
                            )
                        except Exception:
                            print(f'Failed to annotate PDF {fn}')
                            continue

                    annotation_file = os.path.join(directory, f'annotations/{fn}.json')
                    with open(annotation_file, 'w+') as a_f:
                        json.dump(bioc_json, a_f)

                    write_to_file(
                        annotations=annotations,
                        chemical_pubtator=chemical_pubtator,
                        gene_pubtator=gene_pubtator,
                        disease_pubtator=disease_pubtator,
                        species_pubtator=species_pubtator,
                    )

    for f in [chemical_pubtator, gene_pubtator, disease_pubtator, species_pubtator]:
        f.close()


if __name__ == '__main__':
    main()
