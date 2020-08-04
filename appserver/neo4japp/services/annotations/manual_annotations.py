from datetime import datetime
import io
import uuid

from neo4japp.constants import TIMEZONE
from neo4japp.database import (
    db,
    get_annotations_service,
    get_annotations_pdf_parser,
    get_lmdb_dao,
)
from neo4japp.exceptions import (
    RecordNotFoundException,
)
from neo4japp.models import (
    Files,
    FileContent,
)


class ManualAnnotationsService:
    @staticmethod
    def add_inclusions(project_id, file_id, user_id, custom_annotation, annotate_all):
        """ Adds custom annotation to a given file.
        If annotate_all is True, parses the file to find all occurrences of the annotated term.

        Returns the added inclusions.
        """
        file = Files.query.filter_by(
            file_id=file_id,
            project=project_id,
        ).one_or_none()
        if file is None:
            raise RecordNotFoundException('File does not exist')

        annotation_to_add = {
            **custom_annotation,
            'inclusion_date': str(datetime.now(TIMEZONE)),
            'user_id': user_id,
            'uuid': str(uuid.uuid4())
        }

        if annotate_all:
            file_content = FileContent.query.filter_by(id=file.content_id).one_or_none()
            if file_content is None:
                raise RecordNotFoundException('Content for a given file does not exist')

            fp = io.BytesIO(file_content.raw_file)
            pdf_parser = get_annotations_pdf_parser()
            parsed_pdf_chars = pdf_parser.parse_pdf(pdf=fp)
            fp.close()
            tokens = pdf_parser.extract_tokens(parsed_chars=parsed_pdf_chars)
            lmdb_dao = get_lmdb_dao()
            annotator = get_annotations_service(lmdb_dao=lmdb_dao)
            term = custom_annotation['meta']['allText']
            matches = annotator.get_matching_manual_annotations(keyword=term, tokens=tokens)

            def annotation_exists(new_annotation, diff):
                for annotation in file.custom_annotations:
                    if annotation['meta']['allText'] == term and \
                            len(annotation['rects']) == len(new_annotation['rects']):
                        # coordinates can have a small difference depending on
                        # where they come from: annotator or pdf viewer
                        for coords, new_coords in zip(annotation['rects'], new_annotation['rects']):
                            if abs(coords[0] - new_coords[0]) < diff and \
                                    abs(coords[1] - new_coords[1]) < diff and \
                                    abs(coords[2] - new_coords[2]) < diff and \
                                    abs(coords[3] - new_coords[3] < diff):
                                return True
                return False

            def add_annotation(new_annotation):
                return {
                    **annotation_to_add,
                    'pageNumber': new_annotation['pageNumber'],
                    'rects': new_annotation['rects'],
                    'keywords': new_annotation['keywords'],
                    'uuid': str(uuid.uuid4())
                }

            inclusions = [
                add_annotation(match) for match in matches if not annotation_exists(match, 5)
            ]
        else:
            inclusions = [annotation_to_add]

        file.custom_annotations = [*inclusions, *file.custom_annotations]
        db.session.commit()

        return inclusions

    @staticmethod
    def remove_inclusions(project_id, file_id, uuid, remove_all):
        """ Removes custom annotation from a given file.
        If remove_all is True, removes all custom annotations with matching term.

        Returns uuids of the removed inclusions.
        """
        file = Files.query.filter_by(
            file_id=file_id,
            project=project_id,
        ).one_or_none()
        if file is None:
            raise RecordNotFoundException('File does not exist')

        annotation_to_remove = next(
            (ann for ann in file.custom_annotations if ann['uuid'] == uuid), None
        )
        if annotation_to_remove is None:
            return []

        if remove_all:
            term = annotation_to_remove['meta']['allText']
            removed_annotation_uuids = [
                annotation['uuid']
                for annotation in file.custom_annotations
                if annotation['meta']['allText'] == term
            ]
        else:
            removed_annotation_uuids = [uuid]

        file.custom_annotations = [
            ann for ann in file.custom_annotations if ann['uuid'] not in removed_annotation_uuids
        ]
        db.session.commit()

        return removed_annotation_uuids

    @staticmethod
    def add_exclusion(project_id, file_id, user_id, exclusion):
        """ Adds exclusion of automatic annotation to a given file.
        """
        file = Files.query.filter_by(
            file_id=file_id,
            project=project_id,
        ).one_or_none()
        if file is None:
            raise RecordNotFoundException('File does not exist')

        excluded_annotation = {
            **exclusion,
            'user_id': user_id,
            'exclusion_date': str(datetime.now(TIMEZONE))
        }

        file.excluded_annotations = [excluded_annotation, *file.excluded_annotations]
        db.session.commit()

    @staticmethod
    def remove_exclusion(project_id, file_id, user_id, entity_type, term):
        """ Removes exclusion of automatic annotation from a given file.
        """
        file = Files.query.filter_by(
            file_id=file_id,
            project=project_id,
        ).one_or_none()
        if file is None:
            raise RecordNotFoundException('File does not exist')

        excluded_annotation = next(
            (exclusion for exclusion in file.excluded_annotations
                if exclusion['type'] == entity_type and exclusion['text'] == term),
            None
        )
        if excluded_annotation is None:
            raise RecordNotFoundException('Annotation not found')

        file.excluded_annotations = list(file.excluded_annotations)
        file.excluded_annotations.remove(excluded_annotation)
        db.session.merge(file)
        db.session.commit()
