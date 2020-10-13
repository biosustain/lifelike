import attr
import hashlib
import json
import os
import time

from typing import List

from neo4japp.database import (
    get_annotations_service,
    get_annotations_pdf_parser,
    get_bioc_document_service,
    get_entity_recognition
)
from neo4japp.data_transfer_objects import Annotation, SpecifiedOrganismStrain
from neo4japp.factory import create_app
from neo4japp.services.annotations.constants import EntityType, OrganismCategory
from neo4japp.util import compute_hash
from neo4japp.services.annotations.service_helpers import (
    create_annotations as create_annotations_helper
)

import paramiko
import base64


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
    add_offset=True,
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

    # (title length + 1)
    offset_length = len(title) + 1 if add_offset else 0

    for f in [chemical_pubtator, gene_pubtator, disease_pubtator, species_pubtator]:
        print(f'{identifier}|t|{title}', file=f)
        print(f'{identifier}|a|{text}', file=f)

    for annotation in annotations.annotations:
        lo_offset = annotation.lo_location_offset + offset_length
        hi_offset = annotation.hi_location_offset + offset_length
        keyword = annotation.text_in_document
        keyword_type = annotation.meta.type
        id = annotation.meta.id

        if keyword_type == EntityType.CHEMICAL.value:
            print(
                f'{identifier}\t{lo_offset}\t{hi_offset}\t{keyword}\t{keyword_type}\t{id}',
                file=chemical_pubtator,
            )
        elif keyword_type == EntityType.GENE.value:
            print(
                f'{identifier}\t{lo_offset}\t{hi_offset}\t{keyword}\t{keyword_type}\t{id}',
                file=gene_pubtator,
            )
        elif keyword_type == EntityType.DISEASE.value:
            print(
                f'{identifier}\t{lo_offset}\t{hi_offset}\t{keyword}\t{keyword_type}\t{id}',
                file=disease_pubtator,
            )
        elif keyword_type == EntityType.SPECIES.value:
            # only Bacteria for now
            if annotation.meta.category == OrganismCategory.BACTERIA.value:
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
    doc,
    entity_service,
):
    parsed = pdf_parser.parse_pdf(pdf=doc)

    pdf_text_list = pdf_parser.combine_chars_into_words(parsed)
    pdf_text = ' '.join([text for text, _ in pdf_text_list])
    annotations = annotations_service.create_rules_based_annotations(
        tokens=pdf_parser.extract_tokens(parsed_chars=parsed),
        custom_annotations=[],
        specified_organism=SpecifiedOrganismStrain('', '', '')
    )

    bioc = bioc_service.read(text=pdf_text, file_uri=filename)
    bioc_json = bioc_service.generate_bioc_json(annotations=annotations, bioc=bioc)
    return NLPAnnotations(
        filename=filename,
        text=pdf_text,
        annotations=annotations,
    ), bioc_json


def pdf_to_pubtator(
    chemical_pubtator,
    gene_pubtator,
    disease_pubtator,
    species_pubtator,
):
    for parent, subfolders, filenames in os.walk(os.path.join(directory, 'pdfs/')):
        for fn in filenames:
            app = create_app('Functional Test Flask App', config='config.Testing')
            with app.app_context():
                bioc_service = get_bioc_document_service()
                service = get_annotations_service()
                parser = get_annotations_pdf_parser()

                if fn.lower().endswith('.pdf'):
                    with open(os.path.join(parent, fn), 'rb') as f:
                        try:
                            annotations, bioc_json = create_annotations(
                                annotations_service=service,
                                bioc_service=bioc_service,
                                filename=fn,
                                pdf_parser=parser,
                                doc=f,
                            )
                        except Exception as ex:
                            print(f'Failed to annotate PDF {fn}: {str(ex)}')
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


def create_annotations_from_text(text, title):
    nlp_annotations_list = []
    app = create_app('Functional Test Flask App', config='config.Testing')

    with app.app_context():
        try:

            annotations, bioc_json = create_annotations_helper(
                annotation_method='Rules Based',
                specified_organism='',
                document=text,
                filename=title
            )

            nlp_annotations_list.append((NLPAnnotations(
                filename=title,
                text=text,
                annotations=annotations,
            ), bioc_json))
        except Exception as ex:
            raise ex
    return nlp_annotations_list


def text_to_pubtator(
    chemical_pubtator,
    gene_pubtator,
    disease_pubtator,
    species_pubtator,
):
    for parent, subfolders, filenames in os.walk(os.path.join(directory, 'abstracts/')):
        for fn in filenames:
            if fn.lower().endswith('.txt'):
                with open(os.path.join(parent, fn), 'r') as f:
                    try:
                        results = create_annotations_from_text(doc=f, title=fn)
                    except Exception as ex:
                        raise ex

                for (annotations, bioc_json) in results:
                    annotation_file = os.path.join(
                        directory, f'annotations/{annotations.filename}.json')
                    with open(annotation_file, 'w+') as a_f:
                        json.dump(bioc_json, a_f)

                    write_to_file(
                        annotations=annotations,
                        chemical_pubtator=chemical_pubtator,
                        gene_pubtator=gene_pubtator,
                        disease_pubtator=disease_pubtator,
                        species_pubtator=species_pubtator,
                        add_offset=False,
                    )


def text_to_pubtator2(
    chemical_pubtator,
    gene_pubtator,
    disease_pubtator,
    species_pubtator,
):
    client = paramiko.SSHClient()
    client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('nas-server01.biosustain.dtu.dk', username='jining', password='LifeLike001')

    count = 0
    with open(os.path.join(directory, 'abstracts/data-1602546717626.csv')) as path_file:
        headers = next(path_file)
        for line in path_file:
            split_line = line.replace('\n', '').split(',')
            file_path = split_line[1]
            pmcid = split_line[3]
            stdin, stdout, stderr = client.exec_command(f'cat {file_path}/{pmcid}.no-anns.txt')
            results = create_annotations_from_text(list(stdout)[0], f'{pmcid}.no-anns.txt')

            for (annotations, bioc_json) in results:
                annotation_file = os.path.join(
                    directory, f'annotations/{pmcid}.json')
                with open(annotation_file, 'w+') as a_f:
                    json.dump(bioc_json, a_f)

                write_to_file(
                    annotations=annotations,
                    chemical_pubtator=chemical_pubtator,
                    gene_pubtator=gene_pubtator,
                    disease_pubtator=disease_pubtator,
                    species_pubtator=species_pubtator,
                    add_offset=False,
                )

            count += 1
            if count == 20:
                break
    client.close()


def main():
    chemical_pubtator = open(os.path.join(directory, 'chemical_pubtator.txt'), 'w+')
    gene_pubtator = open(os.path.join(directory, 'gene_pubtator.txt'), 'w+')
    disease_pubtator = open(os.path.join(directory, 'disease_pubtator.txt'), 'w+')
    species_pubtator = open(os.path.join(directory, 'species_pubtator.txt'), 'w+')

    # pdf_to_pubtator(
    #     chemical_pubtator=chemical_pubtator,
    #     gene_pubtator=gene_pubtator,
    #     disease_pubtator=disease_pubtator,
    #     species_pubtator=species_pubtator,
    # )

    # text_to_pubtator(
    #     chemical_pubtator=chemical_pubtator,
    #     gene_pubtator=gene_pubtator,
    #     disease_pubtator=disease_pubtator,
    #     species_pubtator=species_pubtator,
    # )

    text_to_pubtator2(
        chemical_pubtator=chemical_pubtator,
        gene_pubtator=gene_pubtator,
        disease_pubtator=disease_pubtator,
        species_pubtator=species_pubtator,
    )

    for f in [chemical_pubtator, gene_pubtator, disease_pubtator, species_pubtator]:
        f.close()


if __name__ == '__main__':
    main()
