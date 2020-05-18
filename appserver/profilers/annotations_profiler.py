import contextlib
import cProfile
import io
import pstats
import os

from datetime import datetime

from neo4japp.database import (
    get_annotations_service,
    get_annotations_pdf_parser,
    get_lmdb_dao,
)
from neo4japp.factory import create_app


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


def create_annotations(
    annotations_service,
    pdf_parser,
    pdf,
):
    with cprofiled():
        parsed = pdf_parser.parse_pdf(pdf=pdf)
        annotations = annotations_service.create_annotations(
            tokens=pdf_parser.extract_tokens(parsed_chars=parsed),
        )
        print('Done')


def main():
    app = create_app('Functional Test Flask App', config='config.Testing')
    with app.app_context():
        service = get_annotations_service(lmdb_dao=get_lmdb_dao())
        parser = get_annotations_pdf_parser()

        pdf = os.path.join(
            directory,
            '../tests/database/services/annotations/pdf_samples/dysregulation-of-the-IFN-y-stat1.pdf')  # noqa

        with open(pdf, 'rb') as f:
            create_annotations(
                annotations_service=service,
                pdf_parser=parser,
                pdf=f,
            )


if __name__ == '__main__':
    main()
