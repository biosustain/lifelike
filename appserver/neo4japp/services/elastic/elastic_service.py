import base64
import itertools
import json
import os
import re
import string

from elasticsearch.helpers import parallel_bulk, BulkIndexError
from flask import current_app
from sqlalchemy.orm import joinedload
from typing import (
    Dict,
    List,
    Optional,
)

from neo4japp.constants import FILE_INDEX_ID
from neo4japp.database import db
from neo4japp.models import (
    Directory,
    Files,
    Project
)
from neo4japp.services.elastic import (
    ATTACHMENT_PIPELINE_ID,
    ELASTIC_INDEX_SEED_PAIRS,
    ELASTIC_PIPELINE_SEED_PAIRS,
)
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
                current_app.logger.error(
                    f'Elastic search bulk operation failed: {info}',
                    extra=EventLog(event_type='elastic').to_dict()
                )

    def delete_documents_with_index(self, file_ids: List[str], index_id: str):
        """
        Deletes all documents with the given ids from Elastic.

        NOTE: These ids are NOT the ids of the postgres rows! They are typically the id the
        user has visibility on, e.g. `file_id` or `hash_id`.
        """
        self.parallel_bulk_documents((
            {
                '_op_type': 'delete',
                '_index': index_id,
                '_id': f_id
            } for f_id in file_ids)
        )
        self.elastic_client.indices.refresh(index_id)

    # TODO: Eventually `index_files` and `index_maps` will be the same service.
    # We could also eventually implement a generic "reindex_thing" service, but
    # this might be difficult because to _get_ the data we want to index we
    # typically have to do joins across multiple tables.

    def index_documents(
        self,
        get_document_results,
        get_elastic_document_objs,
        document_ids: Optional[List[int]],
        batch_size: int = 100
    ):
        results = get_document_results(document_ids, batch_size)

        while True:
            batch = list(itertools.islice(results, batch_size))
            if not batch:
                break

            self.parallel_bulk_documents(get_elastic_document_objs(batch))

    def get_file_results(self, file_ids: List[int] = None, batch_size: int = 100):
        query = db.session.query(
            Files
        ).options(
            joinedload(Files.content),
            joinedload(Files.user),
            joinedload(Files.dir).joinedload(Directory.project)
        ).enable_eagerloads(False)

        if file_ids:
            query = query.filter(Files.id.in_(file_ids))

        return iter(query.yield_per(batch_size))

    def get_elastic_file_objs(self, files: List[Files]):
        return [{
            '_index': FILE_INDEX_ID,
            'pipeline': ATTACHMENT_PIPELINE_ID,
            # TODO Might be able to make this the postgres ID once maps/files are combined.
            # We can't right now because this has to be a unique value, and the postgres
            # IDs aren't (i.e. we might have a map with ID 1 and a file with ID 1).
            # Important note: IDs are not unique across indices.
            '_id': file.file_id,
            '_source': {
                'filename': file.filename,
                'description': file.description,
                'uploaded_date': file.creation_date,
                'data': base64.b64encode(file.content.raw_file).decode('utf-8'),
                'user_id': file.user_id,
                'username': file.user.username,
                'project_id': file.project,
                'project_name': file.project_.project_name,
                'doi': file.doi,
                'public': False,  # TODO: Change this once we can know if a file is public
                'id': file.file_id,
                'type': 'pdf'
            }
        } for file in files]

    def index_files(self, file_ids: List[int] = None, batch_size: int = 100):
        """Adds the files with the given ids to Elastic. If no ids are given, adds all files."""
        self.index_documents(
            self.get_file_results,
            self.get_elastic_file_objs,
            file_ids,
            batch_size,
        )

    def get_map_results(self, map_ids: List[int] = None, batch_size: int = 100):
        query = db.session.query(
            Project
        ).options(
            joinedload(Project.user),
            joinedload(Project.dir).joinedload(Directory.project)
        ).enable_eagerloads(False)

        if map_ids:
            query = query.filter(Project.id.in_(map_ids))

        return iter(query.yield_per(batch_size))

    def get_elastic_map_objs(self, maps: List[Project]):
        map_documents = []  # type:ignore
        for map in maps:
            if isinstance(map.graph, dict):
                map_data: Dict[str, List[Dict[str, str]]] = {'nodes': [], 'edges': []}
                for node in map.graph.get('nodes', []):
                    try:
                        map_data['nodes'].append(
                            {
                                'label': node.get('label', ''),
                                'display_name': node.get('display_name', ''),
                                'detail': node.get('detail', ''),
                            }
                        )
                    except KeyError as e:
                        current_app.logger.error(
                            f'Error while parsing node for elastic indexing: {node}',
                            exc_info=e,
                            extra=EventLog(event_type='elastic').to_dict()
                        )
                        # Continue parsing through remaining nodes
                for edge in map.graph.get('edges', []):
                    try:
                        edge_data = edge.get('data', '')
                        map_data['edges'].append(
                            {
                                'label': edge.get('label', ''),
                                'detail': edge_data.get('detail', '') if edge_data else '',
                            }
                        )
                    except KeyError as e:
                        current_app.logger.error(
                            f'Error while parsing edge for elastic indexing: {edge}',
                            exc_info=e,
                            extra=EventLog(event_type='elastic').to_dict()
                        )
                        # Continue parsing through remaining edges

                map_data_bstr = json.dumps(map_data).encode('utf-8')
                map_documents.append({
                    '_index': FILE_INDEX_ID,
                    'pipeline': ATTACHMENT_PIPELINE_ID,
                    '_id': map.hash_id,
                    '_source': {
                        'filename': map.label,
                        'description': map.description,
                        'uploaded_date': map.creation_date,
                        'data': base64.b64encode(map_data_bstr).decode('utf-8'),
                        'user_id': map.user_id,
                        'username': map.user.username,
                        'project_id': map.dir.projects_id,
                        'project_name': map.dir.project.project_name,
                        'doi': None,
                        'public': map.public,
                        'id': map.hash_id,
                        'type': 'map'
                    }
                })
            else:
                current_app.logger.warning(
                    f'Attempted to add a map with id {map.id} to ElasticSearch ' +
                    f'with graph of unexpected type {type(map.graph)}, expected ' +
                    f'{type(dict())}',
                    extra=EventLog(event_type='elastic').to_dict()
                )
        return map_documents

    def index_maps(self, map_ids: List[int] = None, batch_size: int = 100):
        """Adds the maps with the given ids to Elastic. If no ids are given, adds all maps."""
        self.index_documents(
            self.get_map_results,
            self.get_elastic_map_objs,
            map_ids,
            batch_size,
        )

    def reindex_all_documents(self):
        self.index_files()
        self.index_maps()

    # End indexing methods

    # Begin search methods

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
        search_term: str,
        text_fields: List[str],
        text_field_boosts: Dict[str, int]
    ):
        search_term = search_term.strip()

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

        word_operands = []
        for word in word_stack:
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
        for phrase in phrase_stack:
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
        search_queries = []
        if len(text_fields) > 0:
            search_queries.append(
                self.get_text_match_queries(
                    search_term,
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
        }

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
        es_query = self._build_query_clause(
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
        return es_response

    # End search methods
