import multiprocessing as mp
from http import HTTPStatus
from typing import Dict, Set

import requests

from neo4japp.exceptions import ServerException
from ..constants import (
    NLP_SERVICE_ENDPOINT,
    NLP_SERVICE_SECRET,
    REQUEST_TIMEOUT,
    EntityType
)
from ..data_transfer_objects import NLPResults


def _call_nlp_service(model: str, text: str) -> dict:
    try:
        req = requests.post(
            NLP_SERVICE_ENDPOINT,
            json={'model': model, 'sentence': text},
            headers={'secret': NLP_SERVICE_SECRET},
            timeout=REQUEST_TIMEOUT)
        req.raise_for_status()
        return req.json()

    # Got a non-2xx response
    except requests.exceptions.HTTPError as e:
        raise ServerException(
            'NLP Service Error',
            'An unexpected error occurred with the NLP service.',
            additional_msgs=f'Status: {e.response.status_code}, Body: {e.response.text}',
            code=e.response.status_code)

    # Timeout either when connecting or reading response
    except requests.exceptions.Timeout:
        raise ServerException(
            'NLP Service timeout',
            'Request to NLP service timed out.',
            code=HTTPStatus.GATEWAY_TIMEOUT)

    # Could not decode JSON response
    except ValueError:
        raise ServerException(
            'NLP Service Error',
            'Error while parsing JSON response from NLP Service')

    # Other request errors
    except requests.exceptions.RequestException:
        raise ServerException(
            'NLP Service Error',
            'An unexpected error occurred with the NLP service.',
            code=HTTPStatus.SERVICE_UNAVAILABLE)


def predict(text: str, entities: Set[str]):
    """
    Makes a call to the NLP service.
    Returns the set of entity types in which the token was found.
    """
    if not entities:
        return NLPResults()

    nlp_models = {
        EntityType.CHEMICAL.value: 'bc2gm_v1_chem',
        EntityType.GENE.value: 'bc2gm_v1_gene',
        # TODO: disease has two models
        # for now use ncbi because it has better results
        EntityType.DISEASE.value: 'bc2gm_v1_ncbi_disease'
    }

    nlp_model_types = {
        'bc2gm_v1_chem': EntityType.CHEMICAL.value,
        'bc2gm_v1_gene': EntityType.GENE.value,
        'bc2gm_v1_ncbi_disease': EntityType.DISEASE.value,
        'bc2gm_v1_bc5cdr_disease': EntityType.DISEASE.value
    }

    entity_results: Dict[str, set] = {
        EntityType.ANATOMY.value: set(),
        EntityType.CHEMICAL.value: set(),
        EntityType.COMPOUND.value: set(),
        EntityType.DISEASE.value: set(),
        EntityType.FOOD.value: set(),
        EntityType.GENE.value: set(),
        EntityType.PHENOMENA.value: set(),
        EntityType.PHENOTYPE.value: set(),
        EntityType.PROTEIN.value: set(),
        EntityType.SPECIES.value: set()
    }

    models = []
    if all([model in entities for model in nlp_models]):
        models.append(_call_nlp_service(model='all', text=text))
    else:
        with mp.Pool(processes=4) as pool:
            models = pool.starmap(
                _call_nlp_service, [(
                    nlp_models[model],
                    text
                ) for model in entities if nlp_models.get(model)])

    for model in models:
        for results in model['results']:
            for token in results['annotations']:
                token_offset = (token['start_pos'], token['end_pos']-1)
                entity_results[nlp_model_types[results['model']]].add(token_offset)

    return NLPResults(
        anatomy=entity_results[EntityType.ANATOMY.value],
        chemicals=entity_results[EntityType.CHEMICAL.value],
        # compound will use chemical
        compounds=entity_results[EntityType.CHEMICAL.value],
        diseases=entity_results[EntityType.DISEASE.value],
        foods=entity_results[EntityType.FOOD.value],
        genes=entity_results[EntityType.GENE.value],
        phenomenas=entity_results[EntityType.PHENOMENA.value],
        phenotypes=entity_results[EntityType.PHENOTYPE.value],
        proteins=entity_results[EntityType.PROTEIN.value],
        species=entity_results[EntityType.SPECIES.value],
    )
