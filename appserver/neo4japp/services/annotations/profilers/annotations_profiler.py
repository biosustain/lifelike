import contextlib
import cProfile
import io
import pstats
import os
import attr

from datetime import datetime

from neo4japp.constants import TIMEZONE
from neo4japp.factory import create_app
from neo4japp.models import FileContent
from neo4japp.services.annotations.constants import AnnotationMethod
from neo4japp.services.annotations.data_transfer_objects import SpecifiedOrganismStrain
from neo4japp.services.annotations.pipeline import create_annotations


# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


@attr.s()
class Document:
    parsed_content = attr.ib()
    raw_file = attr.ib()
    custom_annotations = attr.ib()
    excluded_annotations = attr.ib()
    file_content_id = attr.ib()


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


def profile_annotations(pdf):
    with cprofiled():
        bioc = create_annotations(
            AnnotationMethod.RULES.value,
            '',
            '',
            Document(
                parsed_content=None,
                raw_file=pdf,
                custom_annotations=[],
                excluded_annotations=[],
                file_content_id='1'
            ),
            'filename'
        )


def main():
    app = create_app('Functional Test Flask App', config='config.Testing')
    with app.app_context():
        pdf = os.path.join(
            directory,
            '../../../../tests/database/services/annotations/pdf_samples/Sepsis and Shock.pdf')  # noqa

        with open(pdf, 'rb') as f:
            profile_annotations(pdf=f.read())


if __name__ == '__main__':
    main()
