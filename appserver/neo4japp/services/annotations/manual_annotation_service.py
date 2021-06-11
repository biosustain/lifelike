import itertools
import uuid

from datetime import datetime
from flask import current_app
from typing import List

from neo4japp.constants import TIMEZONE, LogEventType
from neo4japp.database import db
from neo4japp.exceptions import AnnotationError
from neo4japp.models import Files, GlobalList, AppUser
from neo4japp.models.files import FileAnnotationsVersion, AnnotationChangeCause
from neo4japp.services.annotations.annotation_graph_service import AnnotationGraphService
from neo4japp.services.annotations.constants import (
    EntityType,
    ManualAnnotationType,
    MAX_ENTITY_WORD_LENGTH,
    MAX_GENE_WORD_LENGTH,
    MAX_FOOD_WORD_LENGTH
)
from neo4japp.services.annotations.data_transfer_objects import PDFWord
from neo4japp.services.annotations.initializer import get_annotation_tokenizer
from neo4japp.services.annotations.util import has_center_point
from neo4japp.util import standardize_str
from neo4japp.utils.logger import EventLog

from .util import parse_content


class ManualAnnotationService:
    def __init__(
        self,
        graph: AnnotationGraphService
    ) -> None:
        self.graph = graph

    def add_inclusions(self, file: Files, user: AppUser, custom_annotation, annotate_all):
        """ Adds custom annotation to a given file.
        If annotate_all is True, parses the file to find all occurrences of the annotated term.

        Returns the added inclusions.
        """
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
            'user_id': user.id,
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
            tokenizer = get_annotation_tokenizer()
            _, parsed = parse_content(file_id=file.id, exclude_references=False)
            is_case_insensitive = custom_annotation['meta']['isCaseInsensitive']

            if custom_annotation['meta']['type'] == EntityType.GENE.value:
                max_words = MAX_GENE_WORD_LENGTH
            elif custom_annotation['meta']['type'] == EntityType.FOOD.value:
                max_words = MAX_FOOD_WORD_LENGTH
            else:
                max_words = MAX_ENTITY_WORD_LENGTH
            matches = self.get_matching_manual_annotations(
                keyword=term,
                is_case_insensitive=is_case_insensitive,
                tokens_list=list(itertools.chain.from_iterable(
                    [tokenizer.create(
                        parsed[idx:max_words + idx]) for idx, token in enumerate(parsed)]))
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
                raise AnnotationError(
                    title='Unable to Annotate',
                    message=f'There was a problem annotating "{term}". ' +
                            'Please make sure the term is correct, ' +
                            'including correct spacing and no extra characters.',
                    additional_msgs=[
                        f'We currently only allow up to {MAX_ENTITY_WORD_LENGTH} word(s)'
                        ' in length for a term. In addition, we'
                        ' have specific word limits for some entity types:',
                        f'Gene: Max {MAX_GENE_WORD_LENGTH} word.',
                        f'Food: Max {MAX_FOOD_WORD_LENGTH} words.'],
                    code=400)
        else:
            if not annotation_exists(annotation_to_add):
                inclusions = [annotation_to_add]
            else:
                raise AnnotationError(
                    title='Unable to Annotate',
                    message='Annotation already exists.', code=400)

        if annotation_to_add['meta']['includeGlobally']:
            self.save_global(
                annotation_to_add,
                ManualAnnotationType.INCLUSION.value,
                file.content_id,
                user
            )

        version = FileAnnotationsVersion()
        version.cause = AnnotationChangeCause.USER
        version.file = file
        version.custom_annotations = file.custom_annotations
        version.excluded_annotations = file.excluded_annotations
        version.user_id = user.id
        db.session.add(version)

        file.custom_annotations = [*inclusions, *file.custom_annotations]

        db.session.commit()

        return inclusions

    def remove_inclusions(self, file: Files, user: AppUser, uuid, remove_all):
        """ Removes custom annotation from a given file.
        If remove_all is True, removes all custom annotations with matching term and entity type.

        Returns uuids of the removed inclusions.
        """
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
        version.user_id = user.id
        db.session.add(version)

        file.custom_annotations = [
            ann for ann in file.custom_annotations if ann['uuid'] not in removed_annotation_uuids
        ]

        db.session.commit()

        return removed_annotation_uuids

    def add_exclusion(self, file: Files, user: AppUser, exclusion):
        """ Adds exclusion of automatic annotation to a given file.
        """
        excluded_annotation = {
            **exclusion,
            'user_id': user.id,
            'exclusion_date': str(datetime.now(TIMEZONE))
        }

        if excluded_annotation['excludeGlobally']:
            self.save_global(
                excluded_annotation,
                ManualAnnotationType.EXCLUSION.value,
                file.content_id,
                user
            )

        version = FileAnnotationsVersion()
        version.cause = AnnotationChangeCause.USER
        version.file = file
        version.custom_annotations = file.custom_annotations
        version.excluded_annotations = file.excluded_annotations
        version.user_id = user.id
        db.session.add(version)

        file.excluded_annotations = [excluded_annotation, *file.excluded_annotations]

        db.session.commit()

    def remove_exclusion(self, file: Files, user: AppUser, entity_type, term):
        """ Removes exclusion of automatic annotation from a given file.
        """
        version = FileAnnotationsVersion()
        version.cause = AnnotationChangeCause.USER
        version.file = file
        version.custom_annotations = file.custom_annotations
        version.excluded_annotations = file.excluded_annotations
        version.user_id = user.id
        db.session.add(version)

        initial_length = len(file.excluded_annotations)
        file.excluded_annotations = [
            exclusion for exclusion in file.excluded_annotations
            if not (exclusion['type'] == entity_type and
                    self._terms_match(term, exclusion['text'], exclusion['isCaseInsensitive']))
        ]

        if initial_length == len(file.excluded_annotations):
            raise AnnotationError(
                title='Failed to Annotate',
                message='File does not have any annotations.',
                code=404)

        db.session.commit()

    def get_combined_annotations(self, file_id):
        """ Returns automatic annotations that were not marked for exclusion
        combined with custom annotations.
        """
        file = Files.query.filter_by(
            file_id=file_id,
        ).one_or_none()
        if file is None:
            raise AnnotationError(
                title='Failed to Annotate',
                message='File does not exist.',
                code=404)

        return self._get_file_annotations(file)

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
        annotations = file.annotations
        # for some reason enrichment table returns list in here
        # should no longer trigger JIRA LL-2820
        # leaving for backward compatibility
        # new tables or re-annotated tables will not have a list
        if isinstance(file.annotations, list):
            annotations = annotations[0]
        annotations = annotations['documents'][0]['passages'][0]['annotations']
        filtered_annotations = [
            annotation for annotation in annotations
            if not isExcluded(file.excluded_annotations, annotation)
        ]
        return filtered_annotations + file.custom_annotations

    def save_global(self, annotation, annotation_type, file_id, user):
        """Adds global inclusion to the KG, and global exclusion to postgres.

        For the KG, if a global inclusion (seen as a synonym) matches to an
        existing entity via entity_id, then a new synonym node is created,
        and a relationship is added that connects that existing entity node
        to the new synonym node.

        If there is no match with an existing entity, then a new node is created
        with the Lifelike domain/node label.
        """
        if annotation_type == ManualAnnotationType.INCLUSION.value:
            try:
                entity_type = annotation['meta']['type']
                entity_id = annotation['meta']['id']
                data_source = annotation['meta']['idType']
                common_name = annotation['primaryName']
                synonym = annotation['meta']['allText']
                inclusion_date = annotation['inclusion_date']
                hyperlink = annotation['meta']['idHyperlink']
                user_full_name = f'{user.first_name} {user.last_name}'
            except KeyError:
                raise AnnotationError(
                    title='Failed to Create Custom Annotation',
                    message='Could not create global annotation inclusion/exclusion, '
                            'the data is corrupted. Please try again.',
                    code=500)

            createval = {
                'entity_type': entity_type,
                'entity_id': entity_id,
                'synonym': synonym,
                'inclusion_date': inclusion_date,
                'user': user_full_name,
                'data_source': data_source,
                'hyperlink': hyperlink,
                'common_name': common_name
            }

            if not self._global_annotation_exists_in_kg(createval):
                queries = {
                    EntityType.ANATOMY.value: self.graph.create_mesh_global_inclusion,
                    EntityType.DISEASE.value: self.graph.create_mesh_global_inclusion,
                    EntityType.FOOD.value: self.graph.create_mesh_global_inclusion,
                    EntityType.GENE.value: self.graph.create_gene_global_inclusion,
                    EntityType.PHENOMENA.value: self.graph.create_mesh_global_inclusion,
                    EntityType.PROTEIN.value: self.graph.create_protein_global_inclusion,
                    EntityType.SPECIES.value: self.graph.create_species_global_inclusion
                }

                query = queries.get(entity_type, '')
                try:
                    result = self.graph.exec_write_query(query, createval) if query else None  # noqa

                    if not result:
                        # did not match to any existing, so add to Lifelike
                        query = self.graph.create_***ARANGO_DB_NAME***_global_inclusion
                        result = self.graph.exec_write_query(query, createval)
                except BrokenPipeError:
                    raise AnnotationError(
                        title='Failed to Create Custom Annotation',
                        message='The graph connection became stale while processing data, '
                                'Please refresh the browser and try again.',
                        code=500)
                except Exception:
                    current_app.logger.error(
                        f'Failed to create global inclusion, knowledge graph failed with query: {query}.',  # noqa
                        extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
                    )
                    raise AnnotationError(
                        title='Failed to Create Custom Annotation',
                        message='A system error occurred while creating the annotation, '
                                'we are working on a solution. Please try again later.',
                        code=500)
        else:
            if not self._global_annotation_exists(annotation, annotation_type):
                # global exclusion
                global_list_annotation = GlobalList(
                    annotation=annotation,
                    type=annotation_type,
                    file_id=file_id,
                )

                try:
                    db.session.add(global_list_annotation)
                    db.session.commit()
                except Exception:
                    db.session.rollback()
                    raise AnnotationError(
                        title='Failed to Create Custom Annotation',
                        message='A system error occurred while creating the annotation, '
                                'we are working on a solution. Please try again later.',
                        code=500)

    def _global_annotation_exists_in_kg(self, values: dict):
        queries = {
            EntityType.ANATOMY.value: self.graph.mesh_global_inclusion_exist,
            EntityType.DISEASE.value: self.graph.mesh_global_inclusion_exist,
            EntityType.FOOD.value: self.graph.mesh_global_inclusion_exist,
            EntityType.GENE.value: self.graph.gene_global_inclusion_exist,
            EntityType.PHENOMENA.value: self.graph.mesh_global_inclusion_exist,
            EntityType.PROTEIN.value: self.graph.protein_global_inclusion_exist,
            EntityType.SPECIES.value: self.graph.species_global_inclusion_exist
        }

        query = queries.get(values['entity_type'], '')
        result = self.graph.exec_read_query(query, values) if query else {'exist': False}

        if result['exist'] is True:
            return result['exist']
        else:
            result = self.graph.exec_read_query(
                self.graph.***ARANGO_DB_NAME***_global_inclusion_exist,
                values)

        return result['exist']

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

    def get_matching_manual_annotations(
        self,
        keyword: str,
        is_case_insensitive: bool,
        tokens_list: List[PDFWord]
    ):
        """Returns coordinate positions and page numbers
        for all matching terms in the document
        """
        matches = []
        for token in tokens_list:
            if not is_case_insensitive:
                if token.keyword != keyword:
                    continue
            elif standardize_str(token.keyword).lower() != standardize_str(keyword).lower():
                continue
            rects = token.coordinates
            keywords = [token.keyword]
            matches.append({
                'pageNumber': token.page_number,
                'rects': rects,
                'keywords': keywords
            })
        return matches
