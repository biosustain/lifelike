import io
import os

from neo4japp.factory import create_app
from neo4japp.util import normalize_str

from neo4japp.services.annotations.constants import DEFAULT_ANNOTATION_CONFIGS
from neo4japp.services.annotations.pipeline import create_annotations_from_text


# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


def main():
    app = create_app('Functional Test Flask App', config='config.QA')

    with app.app_context():
        nothing_found = set()
        gene_not_found = set()
        disease_not_found = set()
        annotated_type_different = set()

        stringio = io.StringIO()
        output_file = open(os.path.join(directory, 'text', 'snippet-removed.tsv'), 'w')

        counter = 0
        with open(os.path.join(directory, 'text', 'snippet.tsv'), 'r') as zenodo:  # noqa
            for file_line, line in enumerate(zenodo):
                counter = file_line + 1

                # headers
                # id:ID(Snippet-ID)
                # pmid
                # sentence_num
                # entry1_text
                # entry1_type
                # entry2_text
                # entry2_type
                # path
                # sentence
                split_line = line.split('\t')
                pubmed_id = split_line[1]
                sentence_num = split_line[2]
                first_entity = split_line[3]
                first_entity_type = split_line[4]
                second_entity = split_line[5]
                second_entity_type = split_line[6]
                sentence = split_line[8]

                annotations = create_annotations_from_text(
                    annotation_configs=DEFAULT_ANNOTATION_CONFIGS,
                    specified_organism_synonym='Homo sapiens',
                    specified_organism_tax_id='9606',
                    text=sentence
                )['documents'][0]['passages'][0]['annotations']

                if len(annotations) == 0:
                    str_to_add = f'{file_line+1}\tfound nothing\t{line[:-1]}'
                    nothing_found.add(str_to_add)
                    print(str_to_add, file=stringio)
                else:
                    first_entity_normed = normalize_str(first_entity)
                    second_entity_normed = normalize_str(second_entity)
                    anno_dict = {normalize_str(anno['textInDocument']): anno['meta']['type'].lower() for anno in annotations}  # noqa

                    if first_entity_normed not in anno_dict:
                        str_to_add = f'{file_line+1}\t{first_entity} not found\t{line[:-1]}'
                        if first_entity_type == 'gene':
                            gene_not_found.add(str_to_add)
                            print(str_to_add, file=stringio)
                        elif first_entity_type == 'disease':
                            disease_not_found.add(str_to_add)
                            print(str_to_add, file=stringio)
                        continue

                    if second_entity_normed not in anno_dict:
                        str_to_add = f'{file_line+1}\t{second_entity} not found\t{line[:-1]}'
                        if second_entity_type == 'gene':
                            gene_not_found.add(str_to_add)
                            print(str_to_add, file=stringio)
                        elif second_entity_type == 'disease':
                            disease_not_found.add(str_to_add)
                            print(str_to_add, file=stringio)
                        continue

                    if anno_dict[first_entity_normed] != first_entity_type:
                        str_to_add = f'{file_line+1}\t{first_entity} type annotated {anno_dict[first_entity_normed]}\t{line[:-1]}'  # noqa
                        if first_entity_type != 'gene' and anno_dict[first_entity_normed] != 'protein':  # noqa
                            annotated_type_different.add(str_to_add)
                            print(str_to_add, file=stringio)
                        continue

                    if anno_dict[second_entity_normed] != second_entity_type:
                        str_to_add = f'{file_line+1}\t{second_entity} type annotated {anno_dict[second_entity_normed]}\t{line[:-1]}'  # noqa
                        if second_entity_type != 'gene' and anno_dict[second_entity_normed] != 'protein':  # noqa
                            annotated_type_different.add(str_to_add)
                            print(str_to_add, file=stringio)
                        continue

        print(f'Found nothing {len(nothing_found)} / {counter} total', file=stringio)
        print(f'Gene not found {len(gene_not_found)} / {counter} total', file=stringio)
        print(f'Disease not found {len(disease_not_found)} / {counter} total', file=stringio)
        print(f'Different type annotated {len(annotated_type_different)} / {counter} total', file=stringio)  # noqa
        print(stringio.getvalue(), file=output_file)
        stringio.close()
        output_file.close()


if __name__ == '__main__':
    main()
