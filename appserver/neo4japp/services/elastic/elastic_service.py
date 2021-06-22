import base64
import json
import re
import string

from elasticsearch.exceptions import RequestError as ElasticRequestError
from elasticsearch.helpers import parallel_bulk, streaming_bulk
from flask import current_app
from io import BytesIO
from neo4j import Record as Neo4jRecord, Transaction as Neo4jTx
from sqlalchemy import and_
from sqlalchemy.orm import joinedload, raiseload
from typing import (
    Dict,
    List,
    Tuple
)

from neo4japp.constants import FILE_INDEX_ID, LogEventType
from neo4japp.database import db, get_file_type_service, ElasticConnection, GraphConnection
from neo4japp.exceptions import ServerException
from neo4japp.models import (
    Files, Projects,
)
from neo4japp.models.files_queries import build_file_hierarchy_query
from neo4japp.services.elastic import (
    ATTACHMENT_PIPELINE_ID,
    ELASTIC_INDEX_SEED_PAIRS,
    ELASTIC_PIPELINE_SEED_PAIRS,
)
from neo4japp.utils import EventLog
from app import app


class ElasticService(ElasticConnection, GraphConnection):
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
                    extra=EventLog(event_type=LogEventType.ELASTIC.value).to_dict()
                )
            except Exception as e:
                current_app.logger.error(
                    f'Failed to delete ElasticSearch index {index_id}',
                    exc_info=e,
                    extra=EventLog(event_type=LogEventType.ELASTIC_FAILURE.value).to_dict()
                )
                return

        try:
            self.elastic_client.indices.create(index=index_id, body=index_definition)
            current_app.logger.info(
                f'Created ElasticSearch index {index_id}',
                extra=EventLog(event_type=LogEventType.ELASTIC.value).to_dict()
            )
        except Exception as e:
            current_app.logger.error(
                f'Failed to create ElasticSearch index {index_id}',
                exc_info=e,
                extra=EventLog(event_type=LogEventType.ELASTIC_FAILURE.value).to_dict()
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
                extra=EventLog(event_type=LogEventType.ELASTIC_FAILURE.value).to_dict()
            )
            return

        current_app.logger.info(
            f'Created or updated ElasticSearch pipeline {pipeline_id}',
            extra=EventLog(event_type=LogEventType.ELASTIC.value).to_dict()
        )

    def recreate_indices_and_pipelines(self):
        """Recreates all currently defined Elastic pipelines and indices. If any indices/pipelines
        do not exist, we create them here. If an index/pipeline does exist, we update it."""
        for (pipeline_id, pipeline_definition_file) in ELASTIC_PIPELINE_SEED_PAIRS:
            self.update_or_create_pipeline(pipeline_id, pipeline_definition_file)

        for (index_id, index_mapping_file) in ELASTIC_INDEX_SEED_PAIRS:
            self.update_or_create_index(index_id, index_mapping_file)
        return 'done'

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
            # TODO: Evaluate the data egress size. When seeding the staging database
            # locally, this could output ~1gb of data. Question: Should we conditionally
            # turn this off?
            if success:
                current_app.logger.info(
                    f'Elastic search bulk operation succeeded: {info}',
                    extra=EventLog(event_type=LogEventType.ELASTIC.value).to_dict()
                )
            else:
                current_app.logger.warning(
                    f'Elastic search bulk operation failed: {info}',
                    extra=EventLog(event_type=LogEventType.ELASTIC_FAILURE.value).to_dict()
                )

    def streaming_bulk_documents(self, documents):
        """Performs a series of bulk operations in elastic, determined by the `documents` input."""
        # `raise_on_exception` set to False so that we don't error out if one of the documents
        # fails to index
        results = streaming_bulk(
            client=self.elastic_client,
            actions=documents,
            max_retries=5,
            raise_on_error=False,
            raise_on_exception=False
        )

        for success, info in results:
            # TODO: Evaluate the data egress size. When seeding the staging database
            # locally, this could output ~1gb of data. Question: Should we conditionally
            # turn this off?
            if success:
                current_app.logger.info(
                    f'Elastic search bulk operation succeeded: {info}',
                    extra=EventLog(event_type=LogEventType.ELASTIC.value).to_dict()
                )
            else:
                current_app.logger.warning(
                    f'Elastic search bulk operation failed: {info}',
                    extra=EventLog(event_type=LogEventType.ELASTIC_FAILURE.value).to_dict()
                )

    def delete_documents(self, document_ids: List[str], index_id: str):
        """
        Deletes all documents with the given file hash IDs from Elastic.
        """
        self.streaming_bulk_documents(({
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

    def windowed_query(self, q, column, windowsize):
        """"Break a Query into chunks on a given column."""

        single_entity = q.is_single_entity
        q = q.add_column(column).order_by(column)
        last_id = None

        while True:
            subq = q
            if last_id is not None:
                subq = subq.filter(column > last_id)
            chunk = subq.limit(windowsize).all()
            if not chunk:
                break
            last_id = chunk[-1][-1]
            for row in chunk:
                if single_entity:
                    yield row[0]
                else:
                    yield row[0:-1]

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
        self.streaming_bulk_documents(
            self._lazy_create_es_docs_for_streaming_bulk(
                self.windowed_query(query, Files.hash_id, batch_size)
            )
        )

    def _lazy_create_es_docs_for_parallel_bulk(self, batch):
        """
        Creates a generator out of the elastic document creation
        process to prevent loading everything into memory.
        :param batch: results from the 'query.yield_per'
        :return: indexable object in generator form
        """

        # Preserve context that is lost from threading when used
        # with the elasticsearch parallel_bulk
        with app.app_context():
            for file, _, _, project, *_ in batch:
                yield self._get_elastic_document(file, project, FILE_INDEX_ID)

    def _lazy_create_es_docs_for_streaming_bulk(self, windowed_query):
        """
        Creates a generator out of the elastic document creation
        process to prevent loading everything into memory.
        :param windowed_query: results from 'windowed_query(query, Files.hash_id, batch_size)'
        :return: indexable object in generator form
        """
        for file, _, _, project, *_ in windowed_query:
            yield self._get_elastic_document(file, project, FILE_INDEX_ID)

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

            # TODO: Threading caused us to lose context, but we should rethink
            # how we do logging. Do we actually need to use the app_context?
            current_app.logger.error(
                f'Failed to generate indexable data for file '
                f'#{file.id} (hash={file.hash_id}, mime type={file.mime_type})',
                exc_info=e,
                extra=EventLog(event_type=LogEventType.ELASTIC_FAILURE.value).to_dict()
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

    def get_matches(self, pattern, string, match_group):
        matches = []
        match = re.search(pattern, string)
        while(match):
            # Add the match to the list, stripping whitespace
            matches.append(match.group(match_group).strip())

            # Get the start and end indices
            start, end = (match.start(), match.end())

            # Splice the string: get everything before start, and after end, placing
            # a single whitespace character between them. The reason we need a
            # buffer between the two halves is because there may have not been a
            # boundary between the matched term and its neighbors. e.g.
            # 'apples" and "bananas' would turn into 'applesbananas' without the
            # buffer in a phrase match.
            string = string[:start] + ' ' + string[end:]

            # Get a new match object, if one exists
            match = re.search(pattern, string)
        return matches, string

    def get_words_phrases_and_wildcards(self, string):
        phrase_regex = r'\"((?:\"\"|[^\"])*)\"'
        wildcard_regex = r'\S*(\?|\*)\S*'

        phrases, string = self.get_matches(phrase_regex, string, 1)
        wildcards, string = self.get_matches(wildcard_regex, string, 0)
        string = string.strip()
        words = re.split(r'\s+', string) if len(string) > 0 else []

        return words, phrases, wildcards

    def generate_multi_match_subclause(
        self,
        phrase: str,
        text_fields: List[str],
        text_field_boosts: Dict[str, int],
    ):
        return {
            'bool': {
                'should': [
                    {
                        'multi_match': {
                            'query': term,  # type:ignore
                            'type': 'phrase',  # type:ignore
                            'fields': [
                                f'{field}^{text_field_boosts[field]}'
                                for field in text_fields
                            ]
                        }
                    }
                    for term in [phrase]
                ]
            }
        }

    def generate_wildcard_match_subclause(
        self,
        wildcard: str,
        text_fields: List[str],
        text_field_boosts: Dict[str, int]
    ):
        return {
            'bool': {
                'should': [
                    {
                        'wildcard': {
                            field: {
                                'value': wildcard,
                                'boost': text_field_boosts[field],
                                'case_insensitive': True
                            }
                        }
                    } for field in text_fields
                ]
            }
        }

    # TODO: Currently unused in favor of using an inline approach. Keeping just in case we need
    # this pattern elsewhere in the future.
    def get_text_match_objs(
            self,
            fields: List[str],
            boost_fields: Dict[str, int],
            word: str,
    ):
        return [
            {
                'term': {
                    field: {
                        'value': word,
                        'boost': boost_fields[field]
                    }
                }
            } for field in fields
        ]

    def get_text_match_queries(
        self,
        words: List[str],
        phrases: List[str],
        wildcards: List[str],
        text_fields: List[str],
        text_field_boosts: Dict[str, int],
    ):
        # Create single word match subclauses (this is the same as phrase matching below, with the
        # addition of exact text matching; This helps with words that contain punctuation)
        word_operands = [
            {
                'bool': {
                    'should': [
                        self.generate_multi_match_subclause(
                            word,
                            text_fields,
                            text_field_boosts
                        )
                    ] + ([
                        # Duplicates the get_text_match_objs above, if we ever need this pattern
                        # elsewhere, replace this with the function
                        {
                            'term': {
                                field: {
                                    'value': word,
                                    'boost': text_field_boosts[field]
                                }
                            }
                        } for field in text_fields
                    ] if any([c in string.punctuation for c in word]) else [])
                }
            }
            for word in words
        ]

        # Create phrase match subclauses
        phrase_operands = [
            self.generate_multi_match_subclause(
                phrase,
                text_fields,
                text_field_boosts
            )
            for phrase in phrases
        ]

        # Create wildcard subclauses
        wildcard_operands = [
            self.generate_wildcard_match_subclause(
                wildcard,
                text_fields,
                text_field_boosts
            )
            for wildcard in wildcards
        ]

        return {
            'bool': {
                'must': word_operands + phrase_operands + wildcard_operands,  # type:ignore
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
            fields: List[str],
            query_filter,
            highlight,
    ):
        search_term = search_term.strip()

        if search_term == '':
            return {
                'query': {
                    'bool': {
                        'must': [
                            query_filter,
                        ],
                    }
                },
                'highlight': highlight
            }, [], {}

        words, phrases, wildcards = self.get_words_phrases_and_wildcards(search_term)

        search_queries = []
        if len(text_fields) > 0:
            search_queries.append(
                self.get_text_match_queries(
                    words,
                    phrases,
                    wildcards,
                    text_fields,
                    text_field_boosts,
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
            'fields': fields,
            'highlight': highlight,
            # Set `_source` to False so we only return the properties specified in `fields`
            '_source': False,
        }, phrases + words + wildcards

    def search(
            self,
            index_id: str,
            search_term: str,
            text_fields: List[str],
            text_field_boosts: Dict[str, int],
            keyword_fields: List[str],
            keyword_field_boosts: Dict[str, int],
            fields: List[str],
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
            fields=fields,
            query_filter=query_filter,
            highlight=highlight,
        )

        try:
            es_response = self.elastic_client.search(
                index=index_id,
                body=es_query,
                from_=offset,
                size=limit,
                rest_total_hits_as_int=True,
            )
        except ElasticRequestError:
            raise ServerException(
                title='Content Search Error',
                message='Something went wrong during content search. Please simplify your query ' +
                        '(e.g. remove terms, filters, flags, etc.) and try again.',
                code=400
            )

        es_response['hits']['hits'] = [doc for doc in es_response['hits']['hits']]
        return es_response, search_phrases
    # End search methods
