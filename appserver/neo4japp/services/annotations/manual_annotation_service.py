import uuid

from datetime import datetime
from http import HTTPStatus

from flask import current_app
from neo4j.exceptions import ServiceUnavailable
from typing import List, Tuple
from uuid import uuid4

from neo4japp.constants import TIMEZONE, LogEventType
from neo4japp.database import db
from neo4japp.exceptions import AnnotationError
from neo4japp.models import Files, GlobalList, AppUser
from neo4japp.models.files import FileAnnotationsVersion, AnnotationChangeCause
from neo4japp.util import standardize_str
from neo4japp.utils.logger import EventLog

from .exceptions import AnnotationLimitationError
from .annotation_graph_service import AnnotationGraphService
from .tokenizer import Tokenizer
from .constants import (
    ManualAnnotationType,
    MAX_ENTITY_WORD_LENGTH,
    MAX_GENE_WORD_LENGTH,
    MAX_FOOD_WORD_LENGTH, COMMON_WORDS, WORD_CHECK_REGEX, MIN_ENTITY_LENGTH
)
from .data_transfer_objects.dto import PDFWord
from .utils.common import has_center_point
from .utils.parsing import parse_content
from .utils.graph_queries import *
from ...utils.globals import warn
from ...warnings import ServerWarning


class ManualAnnotationService:
    def __init__(
        self,
        graph: AnnotationGraphService,
        tokenizer: Tokenizer
    ) -> None:
        self.graph = graph
        self.tokenizer = tokenizer

    def _annotation_exists(
        self,
        term: str,
        new_annotation_metadata: dict,
        custom_annotations: List[dict]
    ):
        for annotation in custom_annotations:
            if (self._terms_match(term, annotation['meta']['allText'],
                                  annotation['meta']['isCaseInsensitive']) and
                    len(annotation['rects']) == len(new_annotation_metadata['rects'])):
                # coordinates can have a small difference depending on
                # where they come from: annotator or pdf viewer
                all_rects_match = all(list(map(
                    has_center_point, annotation['rects'], new_annotation_metadata['rects']
                )))
                if all_rects_match:
                    return True
        return False

    def validate_term(self, term, annotation):
        term_length = len(term.split(' '))

        if annotation['meta']['type'] == EntityType.GENE.value:
            if term_length > MAX_GENE_WORD_LENGTH:
                raise AnnotationLimitationError(
                    message=f'Term "{term}" has {term_length} words, '
                            f'which crosses the limit ({MAX_GENE_WORD_LENGTH}) '
                            f'for "Gene" entity type.'
                )
        elif annotation['meta']['type'] == EntityType.FOOD.value:
            if term_length > MAX_FOOD_WORD_LENGTH:
                raise AnnotationLimitationError(
                    message=f'Term "{term}" has {term_length} words, '
                            f'which crosses the limit ({MAX_FOOD_WORD_LENGTH}) '
                            f'for "Food" entity type.'
                )
        else:
            if term_length > MAX_ENTITY_WORD_LENGTH:
                raise AnnotationLimitationError(
                    message=f'Term "{term}" has {term_length} words, '
                            f'which crosses the maximum term length limit '
                            f'({MAX_ENTITY_WORD_LENGTH}).'
                )

        if len(term) <= MIN_ENTITY_LENGTH:
            raise AnnotationLimitationError(
                message=f'Term ("{term}") must contain more than {MIN_ENTITY_LENGTH} '
                        f'characters to be annotatable.'
            )

        if term.lower() in COMMON_WORDS:
            raise AnnotationLimitationError(
                message=f'Term "{term}" has been listed as commonly used word '
                        f'therefore cannot be annotated.',
                code=HTTPStatus.BAD_REQUEST
            )

        if WORD_CHECK_REGEX.match(term):
            raise AnnotationLimitationError(
                message=f'Term ("{term}") consisting only of punctuation and digits '
                        f'cannot be annotated.',
                code=HTTPStatus.BAD_REQUEST
            )

    def add_inclusions(self, file: Files, user: AppUser, custom_annotation, annotate_all):
        """Adds custom annotation to a given file.

        :params file               file to add custom annotation to
        :params user               user adding the custom annotation
        :params custom_annotation  the custom annotation to create and add
        :params annotate_all       indicate whether to find all occurrences of the annotated term.

        Returns the added inclusions.
        """
        primary_name = custom_annotation['meta']['allText']
        entity_id = custom_annotation['meta']['id']
        entity_type = custom_annotation['meta']['type']

        if entity_id:
            try:
                if entity_type in [
                    EntityType.ANATOMY.value,
                    EntityType.DISEASE.value,
                    EntityType.FOOD.value,
                    EntityType.PHENOMENA.value,
                    EntityType.PHENOTYPE.value,
                    EntityType.CHEMICAL.value,
                    EntityType.COMPOUND.value,
                    EntityType.GENE.value,
                    EntityType.PROTEIN.value,
                    EntityType.SPECIES.value
                ]:
                    primary_name = \
                        self.graph.get_nodes_from_node_ids(entity_type, [entity_id])[entity_id]
            except KeyError:
                pass
            except (BrokenPipeError, ServiceUnavailable):
                raise
            except Exception as e:
                raise AnnotationError(
                    title='Failed to Create Custom Annotation',
                    message='A system error occurred while creating the annotation, '
                            'we are working on a solution. Please try again later.',
                ) from e

        annotation_to_add = {
            **custom_annotation,
            'inclusion_date': str(datetime.now(TIMEZONE)),
            'user_id': user.id,
            'uuid': str(uuid.uuid4()),
            'primaryName': primary_name
        }
        term = custom_annotation['meta']['allText'].strip()

        if annotate_all:
            _, parsed = parse_content(file_id=file.id, exclude_references=False)
            is_case_insensitive = custom_annotation['meta']['isCaseInsensitive']
            self.validate_term(term, custom_annotation)

            matches = self._get_matching_manual_annotations(
                keyword=term,
                is_case_insensitive=is_case_insensitive,
                tokens_list=self.tokenizer.create(parsed)
            )

            try:
                abbrev_of = self.tokenizer.abbreviations[term]
            except KeyError:
                pass
            else:
                raise AnnotationLimitationError(
                    message=f'Term "{term}" cannot be annotated because it has been '
                            f'identified as an acronym of "{" ".join(abbrev_of)}".',
                    # fields=dict(abbrev_of=abbrev_of),
                )

            inclusions = [
                {
                    **annotation_to_add,
                    'pageNumber': meta['page_number'],
                    'rects': meta['rects'],
                    'keywords': meta['keywords'],
                    'uuid': str(uuid.uuid4()),
                    'primaryName': primary_name
                } for meta in matches if
                not self._annotation_exists(term, meta, file.custom_annotations)
            ]

            if not inclusions:
                raise AnnotationError()
        else:
            if not self._annotation_exists(term, annotation_to_add, file.custom_annotations):
                inclusions = [annotation_to_add]
            else:
                raise AnnotationError(
                    message='Annotation already exists.',
                    code=HTTPStatus.BAD_REQUEST
                )

        if annotation_to_add['meta']['includeGlobally']:
            self.save_global(
                annotation_to_add,
                ManualAnnotationType.INCLUSION.value,
                file.content_id,
                file.id,
                file.hash_id,
                user.username
            )

        try:
            version = FileAnnotationsVersion()
            version.cause = AnnotationChangeCause.USER
            version.file = file
            version.custom_annotations = file.custom_annotations
            version.excluded_annotations = file.excluded_annotations
            version.user_id = user.id
            db.session.add(version)

            file.custom_annotations = [*inclusions, *file.custom_annotations]

            db.session.commit()
        except Exception as e:
            db.session.rollback()
            raise AnnotationError(
                title='Failed to Create Custom Annotation',
                message='A system error occurred while creating the annotation, '
                        'we are working on a solution. Please try again later.'
            ) from e

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
                if self._terms_match(
                    term,
                    annotation['meta']['allText'],
                    annotation['meta']['isCaseInsensitive']
                ) and annotation['meta']['type'] == entity_type
            ]
        else:
            removed_annotation_uuids = [uuid]

        try:
            version = FileAnnotationsVersion()
            version.cause = AnnotationChangeCause.USER
            version.file = file
            version.custom_annotations = file.custom_annotations
            version.excluded_annotations = file.excluded_annotations
            version.user_id = user.id
            db.session.add(version)

            file.custom_annotations = [
                ann for ann in file.custom_annotations if
                ann['uuid'] not in removed_annotation_uuids
            ]

            db.session.commit()
        except Exception as e:
            db.session.rollback()
            raise AnnotationError(
                title='Failed to Remove Annotation',
                message='A system error occurred while creating the annotation, '
                        'we are working on a solution. Please try again later.'
            ) from e

        return removed_annotation_uuids

    def remove_global_inclusions(self, inclusion_ids: List[Tuple[int, int]]):
        try:
            self.graph.exec_write_query_with_params(
                get_delete_global_inclusion_query(),
                {'node_ids': [[gid, sid] for gid, sid in inclusion_ids]})
        except (BrokenPipeError, ServiceUnavailable):
            raise
        except Exception as e:
            current_app.logger.error(
                f'Failed executing cypher: {get_delete_global_inclusion_query()}.\n' +
                f'PARAMETERS: <node_ids: {inclusion_ids}>.',
                extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            )
            raise AnnotationError(
                title='Failed to Remove Global Inclusion',
                message='A system error occurred while creating the annotation, '
                        'we are working on a solution. Please try again later.'
            ) from e

        try:
            # we need to do some cleaning up
            # a global could've been added with the wrong entity type
            # so we need to remove those bad labels to prevent
            # incorrect results coming back as synonyms
            results = self.graph.exec_read_query_with_params(
                get_node_labels_and_relationship_query(),
                {'node_ids': [gid for gid, _ in inclusion_ids]})

            for result in results:
                mismatch = set(result['node_labels']) - set(result['rel_entity_types'])
                # remove Taxonomy because there is inconsistency between graph and annotations
                # annotation uses Species instead
                if EntityType.SPECIES.value in result['rel_entity_types']:
                    mismatch.remove('Taxonomy')

                s = ''
                for label in list(mismatch):
                    if label not in result['valid_entity_types']:
                        if label == 'Anatomy':
                            s += ':Anatomy'
                        elif label == 'Chemical':
                            s += ':Chemical'
                        elif label == 'Compound':
                            s += ':Compound'
                        elif label == 'Disease':
                            s += ':Disease'
                        elif label == 'Food':
                            s += ':Food'
                        elif label == 'Gene':
                            s += ':Gene'
                        elif label == 'Phenomena':
                            s += ':Phenomena'
                        elif label == 'Phenotype':
                            s += ':Phenotype'
                        elif label == 'Protein':
                            s += ':Protein'
                        elif label == 'Taxonomy':
                            s += ':Taxonomy'
                if s:
                    self.graph.exec_write_query_with_params(
                        query_builder(['MATCH (n) WHERE id(n) = $node_id', f'REMOVE n{s}']),
                        {'node_id': result['node_id']})
        except (BrokenPipeError, ServiceUnavailable):
            raise
        except Exception as e:
            query = query_builder(["MATCH (n) WHERE id(n) = $node_id", f"REMOVE n{s}"])
            current_app.logger.error(
                f'Failed executing cypher: {query}.\n' +
                f'PARAMETERS: <node_id: {result["node_id"]}>.',
                extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            )
            raise AnnotationError(
                title='Failed to Remove Global Inclusion',
                message='A system error occurred while creating the annotation, '
                        'we are working on a solution. Please try again later.'
            ) from e

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
                file.id,
                file.hash_id,
                user.username
            )

        try:
            version = FileAnnotationsVersion()
            version.cause = AnnotationChangeCause.USER
            version.file = file
            version.custom_annotations = file.custom_annotations
            version.excluded_annotations = file.excluded_annotations
            version.user_id = user.id
            db.session.add(version)

            file.excluded_annotations = [excluded_annotation, *file.excluded_annotations]

            db.session.commit()
        except Exception as e:
            db.session.rollback()
            raise AnnotationError(
                title='Failed to Create Custom Annotation',
                message='A system error occurred while creating the annotation, '
                        'we are working on a solution. Please try again later.'
            ) from e

    def remove_exclusion(self, file: Files, user: AppUser, entity_type, term):
        """ Removes exclusion of automatic annotation from a given file.
        """
        initial_length = len(file.excluded_annotations)
        updated_exclusions = [
            exclusion for exclusion in file.excluded_annotations
            if not (exclusion['type'] == entity_type and
                    self._terms_match(term, exclusion['text'], exclusion['isCaseInsensitive']))]

        if initial_length == len(updated_exclusions):
            raise AnnotationError(
                title='Failed to Annotate',
                message='File does not have any annotations.',
                code=404
            )

        try:
            version = FileAnnotationsVersion()
            version.cause = AnnotationChangeCause.USER
            version.file = file
            version.custom_annotations = file.custom_annotations
            version.excluded_annotations = file.excluded_annotations
            version.user_id = user.id
            db.session.add(version)

            file.excluded_annotations = updated_exclusions
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            raise AnnotationError(
                title='Failed to Remove Annotation',
                message='A system error occurred while creating the annotation, '
                        'we are working on a solution. Please try again later.',
            ) from e

    # TODO: does this belong here?
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

    def save_global(
        self,
        annotation: dict,
        inclusion_type: str,
        file_content_id: str,
        file_id: int,
        file_hash_id: str,
        username: str
    ):
        """Adds global inclusion to the KG, and global exclusion to postgres.

        For the KG, if a global inclusion (seen as a synonym) matches to an
        existing entity via entity_id, then a new synonym node is created,
        and a relationship is added that connects that existing entity node
        to the new synonym node.

        If there is no match with an existing entity, then a new node is created
        with the Lifelike domain/node label.
        """
        if inclusion_type == ManualAnnotationType.INCLUSION.value:
            try:
                meta = annotation['meta']
                entity_type = meta['type']
                entity_id = meta['id']
                data_source = meta.get('idType')
                common_name = annotation['primaryName']
                synonym = meta['allText']
                inclusion_date = annotation['inclusion_date']
                hyperlinks = meta['idHyperlinks']
                username = username
            except KeyError as e:
                raise AnnotationError(
                    title='Failed to Create Custom Annotation',
                    message='Could not create global annotation inclusion/exclusion, '
                            'the data is corrupted. Please try again.',
                ) from e

            if entity_id == '':
                entity_id = f'NULL-{str(uuid4())}'

            createval = {
                'entity_type': entity_type,
                'entity_id': entity_id,
                'synonym': synonym,
                'inclusion_date': inclusion_date,
                'user': username,
                'data_source': data_source,
                'hyperlinks': hyperlinks,
                'common_name': common_name,
                'file_uuid': file_hash_id
            }

            # NOTE:
            # definition of `main node`: the node that contains the common/primary name
            # e. g `Homo sapiens` is the common/primary name, while `human` is the synonym
            check = self._global_annotation_exists_in_kg(createval)
            # several possible scenarios
            # 1. main node exists and synonym exists
            # 2. main node exists and synonym does not exist
            # we care whether the label exist so if it does not, then we can add it
            # 3. main node exists and synonym exists and entity label/type does not exist
            # 4. main node exists and synonym exists and entity label/type exists
            # 5. main node does not exist

            # for Mesh, it is possible some nodes do not have the entity label
            # because they're grouped under TopicalDescriptors
            # so that query returns node_has_entity_label value to check for
            # and add the label for the future
            if check['node_exist'] and (
                    not check['synonym_exist']
                    or check.get('node_has_entity_label', False)
            ):
                queries = {
                    EntityType.ANATOMY.value: get_create_mesh_global_inclusion_query(entity_type),
                    EntityType.DISEASE.value: get_create_mesh_global_inclusion_query(entity_type),
                    EntityType.FOOD.value: get_create_mesh_global_inclusion_query(entity_type),
                    EntityType.PHENOMENA.value: get_create_mesh_global_inclusion_query(entity_type),
                    EntityType.PHENOTYPE.value: get_create_mesh_global_inclusion_query(entity_type),
                    EntityType.CHEMICAL.value: get_create_chemical_global_inclusion_query(),
                    EntityType.COMPOUND.value: get_create_compound_global_inclusion_query(),
                    EntityType.GENE.value: get_create_gene_global_inclusion_query(),
                    EntityType.PROTEIN.value: get_create_protein_global_inclusion_query(),
                    EntityType.SPECIES.value: get_create_species_global_inclusion_query(),
                    EntityType.PATHWAY.value: get_pathway_global_inclusion_exist_query()
                }

                query = queries.get(entity_type, '')
                try:
                    if query:
                        self.graph.exec_write_query_with_params(query, createval)
                    else:
                        query = get_create_lifelike_global_inclusion_query(entity_type)
                        self.graph.exec_write_query_with_params(query, createval)
                except (BrokenPipeError, ServiceUnavailable):
                    raise
                except Exception as e:
                    message = (
                        f'Failed to create global inclusion, '
                        f'knowledge graph failed with query: {query}.'
                    )
                    current_app.logger.error(
                        message,
                        extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
                    )
                    warn(ServerWarning(message=message), cause=e)
            elif not check['node_exist']:
                try:
                    query = get_create_lifelike_global_inclusion_query(entity_type)
                    self.graph.exec_write_query_with_params(query, createval)
                except (BrokenPipeError, ServiceUnavailable):
                    raise
                except Exception as e:
                    message = (
                        f'Failed to create global inclusion, '
                        f'knowledge graph failed with query: {query}.'
                               )
                    current_app.logger.info(
                        message,
                        extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
                    )
                    warn(
                        ServerWarning(message=message),
                        cause=e
                    )
        else:
            if not self._global_annotation_exists(annotation, inclusion_type):
                # global exclusion
                global_list_annotation = GlobalList(
                    annotation=annotation,
                    type=inclusion_type,
                    file_id=file_id,
                    file_content_id=file_content_id
                )

                try:
                    db.session.add(global_list_annotation)
                    db.session.commit()
                except Exception as e:
                    db.session.rollback()
                    raise AnnotationError(
                        title='Failed to Create Custom Annotation',
                        message='A system error occurred while creating the annotation, '
                                'we are working on a solution. Please try again later.',
                    ) from e

    def _global_annotation_exists_in_kg(self, values: dict):
        entity_type = values['entity_type']
        queries = {
            EntityType.ANATOMY.value: get_mesh_global_inclusion_exist_query(entity_type),
            EntityType.DISEASE.value: get_mesh_global_inclusion_exist_query(entity_type),
            EntityType.FOOD.value: get_mesh_global_inclusion_exist_query(entity_type),
            EntityType.PHENOMENA.value: get_mesh_global_inclusion_exist_query(entity_type),
            EntityType.PHENOTYPE.value: get_mesh_global_inclusion_exist_query(entity_type),
            EntityType.CHEMICAL.value: get_chemical_global_inclusion_exist_query(),
            EntityType.COMPOUND.value: get_compound_global_inclusion_exist_query(),
            EntityType.GENE.value: get_gene_global_inclusion_exist_query(),
            EntityType.PROTEIN.value: get_protein_global_inclusion_exist_query(),
            EntityType.SPECIES.value: get_species_global_inclusion_exist_query(),
            EntityType.PATHWAY.value: get_pathway_global_inclusion_exist_query()
        }

        # query can be empty string because some entity types
        # do not exist in the normal domain/labels
        query = queries.get(entity_type, '')
        try:
            check = self.graph.exec_read_query_with_params(query, values)[0] \
                if query else {'node_exist': False}
        except (BrokenPipeError, ServiceUnavailable):
            raise
        except Exception as e:
            message = (
                f'Failed to create global inclusion, '
                f'knowledge graph failed with query: {query}.'
            )
            current_app.logger.error(
                message,
                extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
            )
            warn(ServerWarning(message=message), cause=e)

        if check['node_exist']:
            return check
        else:
            try:
                query = get_lifelike_global_inclusion_exist_query(entity_type)
                check = self.graph.exec_read_query_with_params(query, values)[0]
            except (BrokenPipeError, ServiceUnavailable):
                raise
            except Exception as e:
                message = (
                    f'Failed to create global inclusion, '
                    f'knowledge graph failed with query: {query}.'
                )
                current_app.logger.error(
                    message,
                    extra=EventLog(event_type=LogEventType.ANNOTATION.value).to_dict()
                )
                warn(ServerWarning(message=message), cause=e)

        return check

    def _global_annotation_exists(self, annotation, inclusion_type):
        global_annotations = GlobalList.query.filter_by(type=inclusion_type).all()

        # TODO: once LL-3143 is done, no need to check for inclusions
        for global_annotation in global_annotations:
            if inclusion_type == ManualAnnotationType.INCLUSION.value:
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
        cleaned_term1 = term1.strip()
        cleaned_term2 = term2.strip()
        if is_case_insensitive:
            return cleaned_term1.lower() == cleaned_term2.lower()
        return cleaned_term1 == cleaned_term2

    def _get_matching_manual_annotations(
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
                'page_number': token.page_number,
                'rects': rects,
                'keywords': keywords
            })
        return matches
