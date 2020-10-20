import os

from neo4japp.factory import create_app

from neo4japp.services.annotations.constants import AnnotationMethod
from neo4japp.services.annotations.service_helpers import create_annotations


# reference to this directory
directory = os.path.realpath(os.path.dirname(__file__))


def main():
    app = create_app('Flask App')
    with app.app_context():
        files = ['text1.txt', 'text2.txt']
        for fname in files:
            f = os.path.join(directory, fname)
            text = ''

            with open(f, 'r') as text_file:
                for line in text_file:
                    text += line

            create_annotations(
                annotation_method=AnnotationMethod.RULES.value,
                specified_organism='',
                document=text,
                filename=fname,
            )


if __name__ == '__main__':
    main()
