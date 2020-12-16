import io
import uuid

from datetime import datetime
from sqlalchemy import and_

from neo4japp.constants import TIMEZONE
from neo4japp.database import (
    db,
    get_annotation_service,
    get_annotation_pdf_parser,
    get_entity_recognition
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
from neo4japp.models.files import FileAnnotationsVersion, AnnotationChangeCause
from neo4japp.services.annotations.annotation_graph_service import AnnotationGraphService
from neo4japp.services.annotations.constants import (
    DatabaseType,
    EntityType,
    ManualAnnotationType
)
from neo4japp.services.annotations.util import has_center_point


class ManualAnnotationService:
    def __init__(
        self,
        graph: AnnotationGraphService,
    ) -> None:
        self.graph = graph

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

        # get the primary name
        primary_name = ''
        entity_id = custom_annotation['meta']['id']
        try:
            if custom_annotation['meta']['type'] == EntityType.ANATOMY.value or custom_annotation['meta']['type'] == EntityType.FOOD.value:  # noqa
                primary_name = self.graph.get_mesh_from_mesh_ids([entity_id])[entity_id]
            elif custom_annotation['meta']['type'] == EntityType.CHEMICAL.value:
                primary_name = self.graph.get_chemicals_from_chemical_ids([entity_id])[entity_id]
            elif custom_annotation['meta']['type'] == EntityType.COMPOUND.value:
                primary_name = self.graph.get_compounds_from_compound_ids([entity_id])[entity_id]
            elif custom_annotation['meta']['type'] == EntityType.DISEASE.value:
                primary_name = self.graph.get_diseases_from_disease_ids([entity_id])[entity_id]
            elif custom_annotation['meta']['type'] == EntityType.GENE.value:
                primary_name = self.graph.get_genes_from_gene_ids([entity_id])[entity_id]
            elif custom_annotation['meta']['type'] == EntityType.PROTEIN.value:
                primary_name = self.graph.get_proteins_from_protein_ids([entity_id])[entity_id]
            elif custom_annotation['meta']['type'] == EntityType.SPECIES.value:
                primary_name = self.graph.get_organisms_from_organism_ids([entity_id])[entity_id]
            else:
                primary_name = custom_annotation['meta']['allText']
        except KeyError:
            primary_name = custom_annotation['meta']['allText']

        annotation_to_add = {
            **custom_annotation,
            'inclusion_date': str(datetime.now(TIMEZONE)),
            'user_id': user_id,
            'uuid': str(uuid.uuid4()),
            'primaryName': primary_name
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
            pdf_parser = get_annotation_pdf_parser()
            recognition = get_entity_recognition()
            parsed = pdf_parser.parse_pdf(pdf=fp)
            fp.close()
            tokens_list = recognition.extract_tokens(parsed=parsed)
            annotator = get_annotation_service()
            is_case_insensitive = custom_annotation['meta']['isCaseInsensitive']
            matches = annotator.get_matching_manual_annotations(
                keyword=term,
                is_case_insensitive=is_case_insensitive,
                tokens_list=tokens_list
            )

            def add_annotation(new_annotation, primary_name=None):
                return {
                    **annotation_to_add,
                    'pageNumber': new_annotation['pageNumber'],
                    'rects': new_annotation['rects'],
                    'keywords': new_annotation['keywords'],
                    'uuid': str(uuid.uuid4()),
                    'primaryName': primary_name if primary_name else annotation_to_add['meta']['allText']  # noqa
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

        version = FileAnnotationsVersion()
        version.cause = AnnotationChangeCause.USER
        version.file = file
        version.custom_annotations = file.custom_annotations
        version.excluded_annotations = file.excluded_annotations
        version.user_id = user_id
        db.session.add(version)

        file.custom_annotations = [*inclusions, *file.custom_annotations]

        db.session.commit()

        return inclusions

    def remove_inclusions(self, project_id, file_id, uuid, remove_all, user_id):
        """ Removes custom annotation from a givenf file.
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

        version = FileAnnotationsVersion()
        version.cause = AnnotationChangeCause.USER
        version.file = file
        version.custom_annotations = file.custom_annotations
        version.excluded_annotations = file.excluded_annotations
        version.user_id = user_id
        db.session.add(version)

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

        version = FileAnnotationsVersion()
        version.cause = AnnotationChangeCause.USER
        version.file = file
        version.custom_annotations = file.custom_annotations
        version.excluded_annotations = file.excluded_annotations
        version.user_id = user_id
        db.session.add(version)

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

        version = FileAnnotationsVersion()
        version.cause = AnnotationChangeCause.USER
        version.file = file
        version.custom_annotations = file.custom_annotations
        version.excluded_annotations = file.excluded_annotations
        version.user_id = user_id
        db.session.add(version)

        initial_length = len(file.excluded_annotations)
        file.excluded_annotations = [
            exclusion for exclusion in file.excluded_annotations
            if not (exclusion['type'] == entity_type and
                    self._terms_match(term, exclusion['text'], exclusion['isCaseInsensitive']))
        ]

        if initial_length == len(file.excluded_annotations):
            raise RecordNotFoundException('Annotation not found')

        db.session.commit()

    def get_file_annotations(self, file):
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

    def add_to_global_list(self, annotation, annotation_type, file_id):
        """ Adds inclusion or exclusion to a global_list table
        """
        if self._global_annotation_exists(annotation, annotation_type):
            return

        global_list_annotation = GlobalList(
            annotation=annotation,
            type=annotation_type,
            file_id=file_id,
        )

        db.session.add(global_list_annotation)
        db.session.commit()

    def _global_annotation_exists(self, annotation, annotation_type):
        global_annotations = GlobalList.query.filter_by(
            type=annotation_type
        ).all()
        for global_annotation in global_annotations:
            if annotation_type == ManualAnnotationType.INCLUSION.value:
                existing_term = global_annotation.annotation['meta']['allText']
                existing_type = global_annotation.annotation['meta']['type']
                new_term = annotation['meta']['allText']
                new_type = annotation['meta']['type']
                is_case_insensitive = annotation['meta']['isCaseInsensitive']
            else:
                existing_term = global_annotation.annotation['text']
                existing_type = global_annotation.annotation['type']
                new_term = annotation['text']
                new_type = annotation['type']
                is_case_insensitive = annotation['isCaseInsensitive']
            if new_type == existing_type and \
                    self._terms_match(new_term, existing_term, is_case_insensitive):
                return True
        return False

    def _terms_match(self, term1, term2, is_case_insensitive):
        if is_case_insensitive:
            return term1.lower().rstrip() == term2.lower().rstrip()
        return term1 == term2
