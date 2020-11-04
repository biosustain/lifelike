from datetime import datetime
import io
import uuid
from sqlalchemy import and_
from neo4japp.constants import TIMEZONE
from neo4japp.database import (
    db,
    get_annotations_service,
    get_annotations_pdf_parser,
)
from neo4japp.exceptions import (
    AnnotationError,
    RecordNotFoundException,
    DuplicateRecord,
)
from neo4japp.models import (
    Files,
    FileContent,
    GlobalList,
)
from neo4japp.services.annotations.constants import ManualAnnotationType


class ManualAnnotationsService:
    def add_inclusions(self, project_id, file_id, user_id, custom_annotation, annotate_all):
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
            annotator = get_annotations_service()
            keyword_type = custom_annotation['meta']['type']
            matches = annotator.get_matching_manual_annotations(
                keyword=term, keyword_type=keyword_type, tokens=tokens
            )

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

            if not inclusions:
                raise AnnotationError(f'There was a problem annotating "{term}", please select '
                                      'option to annotate only one occurrence of this term.')
        else:
            if not annotation_exists(annotation_to_add):
                inclusions = [annotation_to_add]
            else:
                raise DuplicateRecord('Annotation already exists.')

        if annotation_to_add['meta']['includeGlobally']:
            self.add_to_global_list(
                annotation_to_add,
                ManualAnnotationType.INCLUSION.value,
                file.content_id
            )

        file.custom_annotations = [*inclusions, *file.custom_annotations]
        db.session.commit()

        return inclusions

    def remove_inclusions(self, project_id, file_id, uuid, remove_all):
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

    def add_exclusion(self, project_id, file_id, user_id, exclusion):
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
            self.add_to_global_list(
                excluded_annotation,
                ManualAnnotationType.EXCLUSION.value,
                file.content_id
            )

        file.excluded_annotations = [excluded_annotation, *file.excluded_annotations]
        db.session.commit()

    def remove_exclusion(self, project_id, file_id, user_id, entity_type, term):
        """ Removes exclusion of automatic annotation from a given file.
        """
        file = Files.query.filter_by(
            file_id=file_id,
            project=project_id,
        ).one_or_none()
        if file is None:
            raise RecordNotFoundException('File does not exist')

        def terms_match(term_to_exclude, term_in_exclusion, is_case_insensitive):
            if is_case_insensitive:
                return term_to_exclude.lower() == term_in_exclusion.lower()
            return term_to_exclude == term_in_exclusion

        initial_length = len(file.excluded_annotations)
        file.excluded_annotations = [
            exclusion for exclusion in file.excluded_annotations
            if not (exclusion['type'] == entity_type and
                    terms_match(term, exclusion['text'], exclusion['isCaseInsensitive']))
        ]

        if initial_length == len(file.excluded_annotations):
            raise RecordNotFoundException('Annotation not found')

        db.session.commit()

    def get_combined_annotations(self, project_id, file_id):
        """ Returns automatic annotations that were not marked for exclusion
        combined with custom annotations.
        """
        file = Files.query.filter_by(
            file_id=file_id,
            project=project_id,
        ).one_or_none()
        if file is None:
            raise RecordNotFoundException('File does not exist')

        return self._get_file_annotations(file)

    def _get_file_annotations(self, file):
        def isExcluded(exclusions, annotation):
            for exclusion in exclusions:
                if annotation['meta']['type'] == exclusion['type'] and \
                        annotation['textInDocument'] == exclusion['text']:
                    return True
            return False
        if len(file.annotations) == 0:
            return file.custom_annotations
        annotations = file.annotations['documents'][0]['passages'][0]['annotations']
        filtered_annotations = [
            annotation for annotation in annotations
            if not isExcluded(file.excluded_annotations, annotation)
        ]
        return filtered_annotations + file.custom_annotations

    def get_combined_annotations_in_project(self, project_id):
        files = Files.query.filter(
            and_(
                Files.project == project_id,
                Files.annotations != []
            )).all()
        annotations = []
        for fi in files:
            annotations.extend(self._get_file_annotations(fi))
        return annotations

    def add_to_global_list(self, annotation, type, file_id):
        """ Adds inclusion or exclusion to a global_list table
        """
        global_list_annotation = GlobalList(
            annotation=annotation,
            type=type,
            file_id=file_id,
        )

        db.session.add(global_list_annotation)
        db.session.commit()
