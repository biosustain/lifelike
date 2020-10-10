import contextlib
import cProfile
import io
import pstats
import os

from datetime import datetime

from neo4japp.database import (
    get_annotations_service,
    get_annotations_pdf_parser,
    get_bioc_document_service,
    get_entity_recognition,
)
from neo4japp.constants import TIMEZONE
from neo4japp.database import db
from neo4japp.factory import create_app
from neo4japp.models import Files

from neo4japp.data_transfer_objects import SpecifiedOrganismStrain


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


def profile_annotations(
    annotator,
    pdf_parser,
    bioc_service,
    entity_service,
    pdf
):
    with cprofiled():
        parsed = pdf_parser.parse_pdf(pdf=pdf)
        tokens = pdf_parser.extract_tokens(parsed_chars=parsed)
        entity_service.set_entity_inclusions(custom_annotations=[])
        entity_service.identify_entities(
            tokens=tokens.token_positions,
            check_entities_in_lmdb=entity_service.get_entities_to_identify()
        )

        annotations = annotator.create_rules_based_annotations(
            tokens=tokens,
            custom_annotations=[],
            entity_results=entity_service.get_entity_match_results(),
            entity_type_and_id_pairs=annotator.get_entities_to_annotate(),
            specified_organism=SpecifiedOrganismStrain('', '', '')
        )

        pdf_text = pdf_parser.combine_all_chars(parsed_chars=parsed)
        bioc = bioc_service.read(text=pdf_text, file_uri='filename')
        bioc_json = bioc_service.generate_bioc_json(
            annotations=annotations, bioc=bioc)

        db.session.bulk_update_mappings(Files, {
            'id': 4,
            'annotations': bioc_json,
            'annotations_date': datetime.now(TIMEZONE),
        })
        db.session.commit()

    print(bioc_json)


def main():
    app = create_app('Functional Test Flask App', config='config.Testing')
    with app.app_context():
        service = get_annotations_service()
        parser = get_annotations_pdf_parser()
        entity_service = get_entity_recognition()
        bioc_service = get_bioc_document_service()

        pdf = os.path.join(
            directory,
            '../../../../tests/database/services/annotations/pdf_samples/Sepsis and Shock.pdf')  # noqa

        with open(pdf, 'rb') as f:
            profile_annotations(
                annotator=service,
                pdf_parser=parser,
                bioc_service=bioc_service,
                entity_service=entity_service,
                pdf=f,
            )


if __name__ == '__main__':
    main()
