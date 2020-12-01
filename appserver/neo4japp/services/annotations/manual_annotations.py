import io
import uuid
import re

from datetime import datetime
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
from neo4japp.services.annotations.util import has_center_point


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

        def annotation_exists(new_annotation):
            for annotation in file.custom_annotations:
                if (self._terms_match(term, annotation['meta']['allText'], annotation['meta']['isCaseInsensitive']) and  # noqa
                            len(annotation['rects']) == len(new_annotation['rects'])):
                    # coordinates can have a small difference depending on
                    # where they come from: annotator or pdf viewer
                    all_rects_match = all(list(map(
                        has_center_point, annotation['rects'], new_annotation['rects']
                    )))
                    if all_rects_match:
                        return True
            return False

        if annotate_all:
            file_content = FileContent.query.filter_by(id=file.content_id).one_or_none()
            if file_content is None:
                raise RecordNotFoundException('Content for a given file does not exist')

            # TODO: make use of ./pipeline.py to be consistent
            # and avoid code change bugs
            fp = io.BytesIO(file_content.raw_file)
            pdf_parser = get_annotations_pdf_parser()
            parsed = pdf_parser.parse_pdf(pdf=fp)
            fp.close()
            tokens_list = pdf_parser.extract_tokens(parsed=parsed)
            annotator = get_annotations_service()
            is_case_insensitive = custom_annotation['meta']['isCaseInsensitive']
            matches = annotator.get_matching_manual_annotations(
                keyword=term,
                is_case_insensitive=is_case_insensitive,
                tokens_list=tokens_list
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
                if self._terms_match(term, annotation['meta']['allText'], annotation['meta']['isCaseInsensitive']) and  # noqa
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

        initial_length = len(file.excluded_annotations)
        file.excluded_annotations = [
            exclusion for exclusion in file.excluded_annotations
            if not (exclusion['type'] == entity_type and
                    self._terms_match(term, exclusion['text'], exclusion['isCaseInsensitive']))
        ]

        if initial_length == len(file.excluded_annotations):
            raise RecordNotFoundException('Annotation not found')

        db.session.commit()

    def apply_custom_hyperlink_and_type(
        self,
        bioc: dict,
        custom_annotations: list
    ) -> dict:
        """Apply custom annotations on top of existing ones.

        This will update the system annotation idHyperlink and idType
        with the ones from custom annotations.
        """
        if custom_annotations:
            annotations = bioc['documents'][0]['passages'][0]['annotations']

            compiled = re.compile(r'(?:[A-Z]+(?=[:]))')

            for anno in annotations:
                for custom in custom_annotations:
                    if (anno.get('meta', {}).get('type') == custom.get('meta', {}).get('type') and
                        self._terms_match(
                            anno.get('textInDocument', 'False'),
                            custom.get('meta', {}).get('allText', 'True'),
                            custom.get('meta', {}).get('isCaseInsensitive'))):

                        if custom.get('meta', {}).get('idHyperlink'):
                            anno['meta']['idHyperlink'] = custom['meta']['idHyperlink']

                        if custom.get('meta', {}).get('idType'):
                            custom_id = custom['meta']['idType'].upper()
                            anno['meta']['idType'] = custom_id
                            if anno.get('meta', {}).get('id') and custom_id not in anno['meta']['id']:  # noqa
                                anno['meta']['id'] = re.sub(compiled, custom_id, anno['meta']['id'])

        return bioc

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
                if (exclusion.get('type') == annotation['meta']['type'] and
                        self._terms_match(
                            exclusion.get('text', 'True'),
                            annotation.get('textInDocument', 'False'),
                            exclusion['isCaseInsensitive'])):
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

    def _terms_match(self, term1, term2, is_case_insensitive):
        if is_case_insensitive:
            return term1.lower().rstrip() == term2.lower().rstrip()
        return term1 == term2
