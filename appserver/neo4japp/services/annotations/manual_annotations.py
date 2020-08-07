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
    DuplicateRecord,
)
from neo4japp.models import (
    Files,
    FileContent,
    GlobalList,
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
        term = custom_annotation['meta']['allText']

        def is_match(coords, new_coords):
            # is a match if center point of existing annotation
            # is in the rectangle coordinates of new annotation
            center_x = (coords[0] + coords[2]) / 2
            center_y = (coords[1] + coords[3]) / 2
            new_x1, new_y1, new_x2, new_y2 = new_coords
            return new_x1 <= center_x <= new_x2 and new_y1 <= center_y <= new_y2

        def annotation_exists(new_annotation):
            for annotation in file.custom_annotations:
                if annotation['meta']['allText'] == term and \
                        len(annotation['rects']) == len(new_annotation['rects']):
                    # coordinates can have a small difference depending on
                    # where they come from: annotator or pdf viewer
                    all_rects_match = all(list(map(
                        is_match, annotation['rects'], new_annotation['rects']
                    )))
                    if all_rects_match:
                        return True
            return False

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
            matches = annotator.get_matching_manual_annotations(keyword=term, tokens=tokens)

            def add_annotation(new_annotation):
                return {
                    **annotation_to_add,
                    'pageNumber': new_annotation['pageNumber'],
                    'rects': new_annotation['rects'],
                    'keywords': new_annotation['keywords'],
                    'uuid': str(uuid.uuid4())
                }

            inclusions = [
                add_annotation(match) for match in matches if not annotation_exists(match)
            ]
        else:
            if not annotation_exists(annotation_to_add):
                inclusions = [annotation_to_add]
            else:
                raise DuplicateRecord('Annotation already exists.')

        if annotation_to_add['meta']['includeGlobally']:
            ManualAnnotationsService.add_to_global_list(annotation_to_add, 'inclusion', file.id)

        file.custom_annotations = [*inclusions, *file.custom_annotations]
        db.session.commit()

        return inclusions

    @staticmethod
    def remove_inclusions(project_id, file_id, uuid, remove_all):
        """ Removes custom annotation from a given file.
        If remove_all is True, removes all custom annotations with matching term and entity type.

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
            entity_type = annotation_to_remove['meta']['type']
            removed_annotation_uuids = [
                annotation['uuid']
                for annotation in file.custom_annotations
                if annotation['meta']['allText'] == term and
                annotation['meta']['type'] == entity_type
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

        if excluded_annotation['excludeGlobally']:
            ManualAnnotationsService.add_to_global_list(excluded_annotation, 'exclusion', file.id)

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

        initial_length = len(file.excluded_annotations)
        file.excluded_annotations = [
            exclusion for exclusion in file.excluded_annotations
            if not (exclusion['type'] == entity_type and exclusion['text'] == term)
        ]

        if initial_length == len(file.excluded_annotations):
            raise RecordNotFoundException('Annotation not found')

        db.session.commit()

    @staticmethod
    def get_combined_annotations(project_id, file_id):
        """ Returns automatic annotations that were not marked for exclusion
        combined with custom annotations.
        """
        file = Files.query.filter_by(
            file_id=file_id,
            project=project_id,
        ).one_or_none()
        if file is None:
            raise RecordNotFoundException('File does not exist')

        def isExcluded(exclusions, annotation):
            for exclusion in exclusions:
                if annotation['meta']['keywordType'] == exclusion['type'] and \
                        annotation['textInDocument'] == exclusion['text']:
                    return True
            return False

        annotations = file.annotations['documents'][0]['passages'][0]['annotations']
        filtered_annotations = [
            annotation for annotation in annotations
            if not isExcluded(file.excluded_annotations, annotation)
        ]

        return filtered_annotations + file.custom_annotations

    @staticmethod
    def add_to_global_list(annotation, type, file_id):
        """ Adds inclusion or exclusion to a global_list table
        """
        global_list_annotation = GlobalList(
            annotation=annotation,
            type=type,
            file_id=file_id,
        )

        db.session.add(global_list_annotation)
        db.session.commit()
