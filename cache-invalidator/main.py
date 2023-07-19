from arango import ArangoClient
from arango.database import StandardDatabase
from arango.http import DefaultHTTPClient
from collections import defaultdict
import json
import logging
import os
import redis
import time
from typing import Any, List, Optional


SUCCESSFUL_SLEEP_TIME = 3600 * 24       # refresh cached data this often
ERROR_INITIAL_SLEEP_TIME = 60           # if error occurs, try again sooner
ERROR_SLEEP_TIME_MULTIPLIER = 2         # on subsequent errors, sleep longer
ERROR_MAX_SLEEP_TIME = 3600 * 6         # but not longer than this
CACHE_EXPIRATION_TIME = 3600 * 24 * 14  # expire cached data

DEFAULT_LOG_LEVEL = logging.DEBUG

logging.basicConfig()
logger = logging.getLogger('KG-Statistics')
try:
    log_level = getattr(logging, os.environ.get('LOG_LEVEL').upper())
except:
    log_level = DEFAULT_LOG_LEVEL
logger.setLevel(log_level)
logger.info(f'Set log level to {log_level}')


def _get_redis_connection_url():
    host = os.environ.get('REDIS_HOST')
    port = os.environ.get('REDIS_PORT')
    password = os.environ.get('REDIS_PASSWORD')
    ssl = os.environ.get('REDIS_SSL', 'false').lower()
    connection_prefix = 'rediss' if ssl == 'true' else 'redis'
    return f'{connection_prefix}://:{password}@{host}:{port}/0'


def _cache_data(key, value):
    # Establish Redis Connection
    redis_server = redis.Redis(
        connection_pool=redis.BlockingConnectionPool.from_url(_get_redis_connection_url())
    )
    try:
        redis_server.set(key, json.dumps(value))
        redis_server.expire(key, CACHE_EXPIRATION_TIME)
    except:
        redis_server.connection_pool.disconnect()
        raise
    else:
        redis_server.connection_pool.disconnect()


def _create_arango_client(hosts=None) -> ArangoClient:
    # Need a custom HTTP client for Arango because the default timeout is only 60s
    class CustomHTTPClient(DefaultHTTPClient):
        REQUEST_TIMEOUT = 1000

    hosts = hosts or os.getenv('ARANGO_HOST')
    return ArangoClient(
        hosts=hosts,
        # Without this setting any requests to Arango will fail because we don't have a valid cert
        verify_override=False,
        http_client=CustomHTTPClient()
    )


def _get_db(
    arango_client: ArangoClient,
    name: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None
):
    return arango_client.db(
        name=name or os.getenv('ARANGO_DB_NAME'),
        username=username or os.getenv('ARANGO_USERNAME'),
        password=password or os.getenv('ARANGO_PASSWORD'),
    )


def _execute_arango_query(db: StandardDatabase, query: str, batch_size=None, **bind_vars) -> List[Any]:
    cursor = db.aql.execute(
        query,
        ttl=600,
        max_runtime=600,
        batch_size=batch_size,
        bind_vars=bind_vars
    )
    return cursor


def _entity_count_in_domain_query(domain: str) -> str:
    return f'''
    FOR doc IN {domain}
        FOR label IN doc.labels
        COLLECT entity = label WITH COUNT INTO length
        RETURN {{
            'entity' : entity,
            'count' : length
        }}
    '''

def _entity_count_in_ncbi_query() -> str:
    return '''
        FOR doc IN ncbi
            FOR label IN doc.labels
                COLLECT entity = label WITH COUNT INTO length
                RETURN {
                    'entity' : entity,
                    'count' : length
                }
    '''


def _taxonomy_count_query() -> str:
    return '''
    RETURN LENGTH(
        FOR doc IN taxonomy
            FILTER doc.data_source == 'NCBI Taxonomy'
            RETURN doc
    )
    '''


def _entity_count_in_biocyc_query() -> str:
    return '''
    FOR doc IN biocyc
        LET filtered_labels = REMOVE_VALUES(doc.labels, @biocyc_sub_domains)
        FOR label IN filtered_labels
            COLLECT entity = label WITH COUNT INTO length
            RETURN {
                'entity' : entity,
                'count' : length
            }
    '''


def _entity_count_in_biocyc_subdomain_query() -> str:
    return '''
        FOR domain IN @biocyc_sub_domains
            LET entity_counts_for_domain = (
                FOR doc IN biocyc
                    FILTER domain IN doc.labels
                    LET filtered_labels = REMOVE_VALUES(doc.labels, @biocyc_sub_domains)
                    FOR label IN filtered_labels
                        COLLECT entity = label WITH COUNT INTO length
                        RETURN {
                            'entity' : entity,
                            'count' : length
                        }
            )
            RETURN {
                'domain': domain,
                'entities': entity_counts_for_domain
            }
    '''


def _cache_kg_statistics():
    logger.info('Getting Kg Statistics')
    arango_client = _create_arango_client()
    statistics = defaultdict(lambda: defaultdict())
    try:
        arango_db = _get_db(arango_client)
        logger.info('Kg Statistics Query start...')
        other_domains = {
            'literature': 'Literature',
            'go': 'GO',
            'pubmed': 'PubMed',
            'mesh': 'MESH',
            'uniprot': 'UniProt',
            'chebi': 'CHEBI',
            'enzyme': 'Enzyme',
            'regulondb': 'RegulonDB',
            'string': 'String',
            'kegg': 'KEGG',
            '***ARANGO_DB_NAME***': 'Lifelike'
        }

        biocyc_sub_domains = [
            'db_HumanCyc',
            'db_PseudomonasCyc',
            'db_YeastCyc',
            'db_BsubCyc',
            'db_EcoCyc'
        ]

        logger.info('Getting stats for all domains aside from BioCyc and NCBI...')
        for collection_name, display_name in other_domains.items():
            stats = _execute_arango_query(arango_db, _entity_count_in_domain_query(collection_name))
            statistics[display_name] = defaultdict(lambda: defaultdict())
            for result in stats:
                statistics[display_name][result.get('entity')] = result.get('count')

        logger.info('Getting stats for NCBI...')
        statistics['NCBI'] = defaultdict(lambda: defaultdict())
        ncbi_stats = _execute_arango_query(arango_db, _entity_count_in_ncbi_query())
        for row in ncbi_stats:
            statistics['NCBI'][row.get('entity')] = row.get('count')

        taxonomy_count = _execute_arango_query(arango_db, _taxonomy_count_query())
        for count in taxonomy_count:
            # This should loop only once, the _execute_arango_query always returns a generator,
            # but in this case it returns only one value
            statistics['NCBI']['Taxonomy'] = count

        logger.info('Getting stats for all of BioCyc...')
        statistics['BioCyc'] = defaultdict(lambda: defaultdict())
        biocyc_stats = _execute_arango_query(
            arango_db,
            _entity_count_in_biocyc_query(),
            biocyc_sub_domains=biocyc_sub_domains
        )
        for entity_row in biocyc_stats:
            statistics['BioCyc'][entity_row.get('entity')] = entity_row.get('count')

        logger.info('Getting stats for all BioCyc subdomains...')
        entities_count_in_biocyc_subdomains = _execute_arango_query(
            arango_db,
            _entity_count_in_biocyc_subdomain_query(),
            biocyc_sub_domains=biocyc_sub_domains
        )
        for domain_row in entities_count_in_biocyc_subdomains:
            domain = domain_row.get('domain').split('_')[1]
            statistics[domain] = defaultdict(lambda: defaultdict())
            for entity_row in domain_row.get('entities'):
                statistics[domain][entity_row.get('entity')] = entity_row.get('count')
    except:
        arango_client.close()
        raise
    else:
        arango_client.close()
        logger.info('Kg Statistics Query finished with data:')
        logger.info(json.dumps(statistics, indent=4))
        _cache_data('kg_statistics', statistics)


def _get_organism_genes_go_terms_query() -> str:
    return '''
        LET go_links_grouped_by_organism = (
            FOR link IN go_link
                FILTER link.tax_id != null
                COLLECT organism = link.tax_id INTO links
                RETURN {
                    'organism': organism,
                    'links': links
                }
        )
        FOR row IN go_links_grouped_by_organism
            LET organism_name = FIRST(
                FOR doc IN taxonomy
                    FILTER doc.eid == row.organism
                    RETURN doc.name
            )
            LET gene_names_grouped_by_go_term = (
                FOR go_link IN row.links
                    COLLECT go = go_link.link._to INTO groups
                    LET go_doc = DOCUMENT(go)
                    RETURN {
                        'goId': go_doc.eid,
                        'goTerm': go_doc.name,
                        'goLabels': go_doc.labels,
                        'geneNames': DOCUMENT(groups[*].go_link.link._from)[*].name
                    }
            )
            RETURN {
                'organism': {
                    'id': row.organism,
                    'name': organism_name
                },
                'go_terms': gene_names_grouped_by_go_term
            }
    '''


def _precalculate_go():
    logger.info('Precalculating GO...')
    arango_client = _create_arango_client()

    try:
        arango_db = _get_db(arango_client)
        results = _execute_arango_query(
            arango_db,
            query=_get_organism_genes_go_terms_query(),
            # Normally would make a global for this but it's very unlikely we'll ever re-use this
            # value.
            batch_size=5
        )

        for row in results:
            organism = row['organism']
            go_terms = row['go_terms']
            logger.info(f'Caching GO for {organism["name"]} ({organism["id"]})')
            _cache_data(
                f'GO_for_{organism["id"]}',
                go_terms
            )
    except:
        arango_client.close()
        raise
    arango_client.close()



def main():
    next_error_sleep_time = ERROR_INITIAL_SLEEP_TIME
    kg_statistics_successful = False
    precalculate_go_successful = False
    time_slept_since_reset = 0
    while True:
        if time_slept_since_reset >= SUCCESSFUL_SLEEP_TIME:
            kg_statistics_successful = False
            precalculate_go_successful = False
        try:
            if not kg_statistics_successful:
                _cache_kg_statistics()
                kg_statistics_successful = True
        except Exception as err:
            logger.error(err)
            kg_statistics_successful = False
        finally:
            try:
                if not precalculate_go_successful:
                    _precalculate_go()
                    precalculate_go_successful = True
            except Exception as err:
                logger.error(err)
                precalculate_go_successful = False
            else:
                if kg_statistics_successful and precalculate_go_successful:
                    next_error_sleep_time = ERROR_INITIAL_SLEEP_TIME
                    logger.info(f'Going to sleep for {SUCCESSFUL_SLEEP_TIME} seconds...')
                    time.sleep(SUCCESSFUL_SLEEP_TIME)
                    time_slept_since_reset += SUCCESSFUL_SLEEP_TIME
                else:
                    logger.info(f'Error occured, will try again in {next_error_sleep_time} seconds')
                    time.sleep(next_error_sleep_time)
                    time_slept_since_reset += next_error_sleep_time
                    next_error_sleep_time = min(ERROR_MAX_SLEEP_TIME, next_error_sleep_time * ERROR_SLEEP_TIME_MULTIPLIER)


if __name__ == "__main__":
    main()
