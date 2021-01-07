import base64
import itertools
import json
import string
from io import BytesIO
from typing import (
    Dict,
    List,
)

from elasticsearch.helpers import parallel_bulk
from flask import current_app
from sqlalchemy import and_
from sqlalchemy.orm import joinedload, raiseload, lazyload

from neo4japp.constants import FILE_INDEX_ID
from neo4japp.database import db, get_file_type_service
from neo4japp.models import (
    Files, Projects,
)
from neo4japp.models.files_queries import build_file_hierarchy_query
from neo4japp.services.elastic import (
    ATTACHMENT_PIPELINE_ID,
    ELASTIC_INDEX_SEED_PAIRS,
    ELASTIC_PIPELINE_SEED_PAIRS,
)
from neo4japp.services.file_types.providers import MapTypeProvider
from neo4japp.utils import EventLog


class ElasticService():
    def __init__(self, elastic):
        self.elastic_client = elastic

    # Begin indexing methods

    def update_or_create_index(self, index_id, index_mapping_file):
        """Creates an index with the given index id and mapping file. If the index already exists,
        we update it and re-index any documents using that index."""
        with open(index_mapping_file) as f:
            index_definition_data = f.read()
        index_definition = json.loads(index_definition_data)

        if self.elastic_client.indices.exists(index_id):
            # Here, we delete the index and re-create it. The reason for this is that, if
            # we update the type of a field in the index, elastic will complain and fail to update
            # the index. So to prevent this from happening, we just trash the index and re-create
            # it.
            try:
                self.elastic_client.indices.delete(index=index_id)
                current_app.logger.info(
                    f'Deleted ElasticSearch index {index_id}',
                    extra=EventLog(event_type='elastic').to_dict()
                )
            except Exception as e:
                current_app.logger.error(
                    f'Failed to delete ElasticSearch index {index_id}',
                    exc_info=e,
                    extra=EventLog(event_type='elastic').to_dict()
                )
                return

        try:
            self.elastic_client.indices.create(index=index_id, body=index_definition)
            current_app.logger.info(
                f'Created ElasticSearch index {index_id}',
                extra=EventLog(event_type='elastic').to_dict()
            )
        except Exception as e:
            current_app.logger.error(
                f'Failed to create ElasticSearch index {index_id}',
                exc_info=e,
                extra=EventLog(event_type='elastic').to_dict()
            )
            return

        # If we trash the index we also need to re-index all the documents that used it.
        # Currently we take the safe route and simply re-index ALL documents, regardless of
        # which index was actually re-created.
        self.reindex_all_documents()

    def update_or_create_pipeline(self, pipeline_id, pipeline_definition_file):
        """Creates a pipeline with the given pipeline id and definition file. If the pipeline
        already exists, we update it."""
        with open(pipeline_definition_file) as f:
            pipeline_definition = f.read()
        pipeline_definition_json = json.loads(pipeline_definition)

        try:
            self.elastic_client.ingest.put_pipeline(id=pipeline_id, body=pipeline_definition_json)
        except Exception as e:
            current_app.logger.error(
                f'Failed to create or update ElasticSearch pipeline {pipeline_id}',
                exc_info=e,
                extra=EventLog(event_type='elastic').to_dict()
            )
            return

        current_app.logger.info(
            f'Created or updated ElasticSearch pipeline {pipeline_id}',
            extra=EventLog(event_type='elastic').to_dict()
        )

    def recreate_indices_and_pipelines(self):
        """Recreates all currently defined Elastic pipelines and indices. If any indices/pipelines
        do not exist, we create them here. If an index/pipeline does exist, we update it."""
        for (pipeline_id, pipeline_definition_file) in ELASTIC_PIPELINE_SEED_PAIRS:
            self.update_or_create_pipeline(pipeline_id, pipeline_definition_file)

        for (index_id, index_mapping_file) in ELASTIC_INDEX_SEED_PAIRS:
            self.update_or_create_index(index_id, index_mapping_file)

    def parallel_bulk_documents(self, documents):
        """Performs a series of bulk operations in elastic, determined by the `documents` input."""
        # `raise_on_exception` set to False so that we don't error out if one of the documents
        # fails to index
        results = parallel_bulk(
            self.elastic_client,
            documents,
            raise_on_error=False,
            raise_on_exception=False
        )

        for success, info in results:
            if success:
                current_app.logger.info(
                    f'Elastic search bulk operation succeeded: {info}',
                    extra=EventLog(event_type='elastic').to_dict()
                )
            else:
                current_app.logger.warning(
                    f'Elastic search bulk operation failed: {info}',
                    extra=EventLog(event_type='elastic').to_dict()
                )

    def delete_documents(self, document_ids: List[str], index_id: str):
        """
        Deletes all documents with the given file hash IDs from Elastic.
        """
        self.parallel_bulk_documents(({
            '_op_type': 'delete',
            '_index': index_id,
            '_id': document_id
        } for document_id in document_ids))
        self.elastic_client.indices.refresh(index_id)

    def index_or_delete_files(self, hash_ids: List[str]):
        self._delete_files(hash_ids)
        self._index_files(hash_ids)

    def _delete_files(self, hash_ids: List[str]):
        self.delete_documents(hash_ids, FILE_INDEX_ID)

    def _index_files(self, hash_ids: List[str] = None, batch_size: int = 100):
        """
        Adds the files with the given ids to Elastic. If no IDs are given,
        all non-deleted files will be indexed.
        :param ids: a list of file table IDs (integers)
        :param batch_size: number of documents to index per batch
        """
        filters = [
            Files.deletion_date.is_(None),
            Files.recycling_date.is_(None),
        ]

        if hash_ids is not None:
            filters.append(Files.hash_id.in_(hash_ids))

        query = self._get_file_hierarchy_query(and_(*filters))
        results = iter(query.yield_per(batch_size))

        while True:
            batch = list(itertools.islice(results, batch_size))

            if not batch:
                break

            self.parallel_bulk_documents([
                self._get_elastic_document(file, project, FILE_INDEX_ID) for
                file, initial_id, level, project, *_ in batch
            ])

    def _get_file_hierarchy_query(self, filter):
        """
        Generate the query to get files that will be indexed.
        :param filter: SQL Alchemy filter
        :return: the query
        """
        return build_file_hierarchy_query(filter, Projects, Files) \
            .options(raiseload('*'),
                     joinedload(Files.user),
                     joinedload(Files.content))

    def _get_elastic_document(self, file: Files, project: Projects, index_id) -> dict:
        """
        Generate the Elastic document sent to Elastic for the given file.
        :param file: the file
        :param project: the project that file is within
        :param index_id: the index
        :return: a document
        """
        try:
            indexable_content = self._transform_data_for_indexing(file).getvalue()
            data_ok = True
        except Exception as e:
            # We should still index the file even if we can't transform it for
            # indexing because the file won't ever appear otherwise and it will be
            # harder to track down the bug
            indexable_content = b''
            data_ok = False

            current_app.logger.error(
                f'Failed to generate indexable data for file '
                f'#{file.id} (hash={file.hash_id}, mime type={file.mime_type})',
                exc_info=e,
                extra=EventLog(event_type='elastic').to_dict()
            )

        return {
            '_index': index_id,
            'pipeline': ATTACHMENT_PIPELINE_ID,
            '_id': file.hash_id,
            '_source': {
                'filename': file.filename,
                'description': file.description,
                'uploaded_date': file.creation_date,
                'data': base64.b64encode(indexable_content).decode('utf-8'),
                'user_id': file.user_id,
                'username': file.user.username,
                'project_id': project.id,
                'project_hash_id': project.hash_id,
                'project_name': project.name,
                'doi': file.doi,
                'public': file.public,
                'id': file.id,
                'hash_id': file.hash_id,
                'mime_type': file.mime_type,
                'data_ok': data_ok,
            }
        }

    def _transform_data_for_indexing(self, file: Files) -> BytesIO:
        """
        Get the file's contents in a format that can be indexed by Elastic, or is
        better indexed by Elatic.
        :param file: the file
        :return: the bytes to send to Elastic
        """
        if file.content:
            content = file.content.raw_file
            file_type_service = get_file_type_service()
            return file_type_service.get(file).to_indexable_content(BytesIO(content))
        else:
            return BytesIO()

    def reindex_all_documents(self):
        self._index_files()

    # End indexing methods

    # Begin search methods

    def get_words_and_phrases_from_search_term(
            self,
            search_term: str,
    ):
        term = ''
        parsing_phrase = False
        word_stack = []
        phrase_stack = []
        for c in search_term:
            if c == '"':
                if parsing_phrase:
                    phrase_stack.append(term)
                    term = ''
                    parsing_phrase = False
                else:
                    if term != '':
                        word_stack.append(term)
                        term = ''
                    parsing_phrase = True
                continue

            if c == ' ' and not parsing_phrase:
                if term != '':
                    word_stack.append(term)
                    term = ''
                continue
            term += c
        if term != '':
            # If a phrase doesn't have a closing `"`, it's possible that multiple
            # words might be in the term. So, split the term and extend the
            # word_stack.
            word_stack.extend(term.split(' '))

        return word_stack, phrase_stack

    def get_text_match_objs(
            self,
            fields: List[str],
            boost_fields: Dict[str, int],
            word: str
    ):
        multi_match_obj = {
            'multi_match': {
                'query': word,
                'type': 'phrase',
                'fields': [f'{field}^{boost_fields[field]}' for field in fields]
            }
        }

        term_objs = [
            {
                'term': {
                    field: {
                        'value': word,
                        'boost': boost_fields[field]
                    }
                }
            } for field in fields
        ]

        return [multi_match_obj] + term_objs  # type:ignore

    def get_text_match_queries(
            self,
            words: List[str],
            phrases: List[str],
            text_fields: List[str],
            text_field_boosts: Dict[str, int]
    ):
        word_operands = []
        for word in words:
            if any([c in string.punctuation for c in word]):
                word_operands.append(
                    {
                        'bool': {
                            'should': self.get_text_match_objs(text_fields, text_field_boosts, word)
                        }
                    }
                )
            else:
                word_operands.append({
                    'multi_match': {
                        'query': word,  # type:ignore
                        'type': 'phrase',  # type:ignore
                        'fields': [f'{field}^{text_field_boosts[field]}' for field in text_fields]
                    }
                })

        phrase_operands = []
        for phrase in phrases:
            phrase_operands.append({
                'multi_match': {
                    'query': phrase,
                    'type': 'phrase',
                    'fields': [f'{field}^{text_field_boosts[field]}' for field in text_fields]
                }
            })

        return {
            'bool': {
                'must': word_operands + phrase_operands,  # type:ignore
            }
        }

    def get_keyword_match_queries(
            self,
            search_term: str,
            keyword_fields: List[str],
            keyword_field_boosts: Dict[str, int]
    ):
        return {
            'bool': {
                'should': [
                    {
                        'term': {
                            field: {
                                'value': search_term,
                                'boost': keyword_field_boosts[field]
                            }
                        }
                    } for field in keyword_fields
                ]
            }
        }

    def _build_query_clause(
            self,
            search_term: str,
            text_fields: List[str],
            text_field_boosts: Dict[str, int],
            keyword_fields: List[str],
            keyword_field_boosts: Dict[str, int],
            query_filter,
            highlight,
    ):
        search_term = search_term.strip()
        words, phrases = self.get_words_and_phrases_from_search_term(search_term)

        search_queries = []
        if len(text_fields) > 0:
            search_queries.append(
                self.get_text_match_queries(
                    words,
                    phrases,
                    text_fields,
                    text_field_boosts
                )
            )

        if len(keyword_fields) > 0:
            search_queries.append(
                self.get_keyword_match_queries(
                    search_term,
                    keyword_fields,
                    keyword_field_boosts
                )
            )

        return {
                   'query': {
                       'bool': {
                           'must': [
                               {
                                   'bool': {
                                       'should': search_queries,

                                   }
                               },
                               query_filter,
                           ],
                       }
                   },
                   'highlight': highlight
               }, phrases + words

    def search(
            self,
            index_id: str,
            search_term: str,
            text_fields: List[str],
            text_field_boosts: Dict[str, int],
            keyword_fields: List[str],
            keyword_field_boosts: Dict[str, int],
            offset: int = 0,
            limit: int = 10,
            query_filter=None,
            highlight=None
    ):
        es_query, search_phrases = self._build_query_clause(
            search_term=search_term,
            text_fields=text_fields,
            text_field_boosts=text_field_boosts,
            keyword_fields=keyword_fields,
            keyword_field_boosts=keyword_field_boosts,
            query_filter=query_filter,
            highlight=highlight,
        )

        es_response = self.elastic_client.search(
            index=index_id,
            body=es_query,
            from_=offset,
            size=limit,
            rest_total_hits_as_int=True,
        )
        es_response['hits']['hits'] = [doc for doc in es_response['hits']['hits']]
        return es_response, search_phrases

    # End search methods
