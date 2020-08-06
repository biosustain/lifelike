import { SearchParameters } from '../../interfaces';
import { DOMAIN_MAP, ENTITY_TYPE_MAP } from '../../shared/database';
import { VIZ_SEARCH_LIMIT } from '../../shared/constants';

export function getQueryParams(params: SearchParameters) {
  return {
    q: params.query,
    page: params.page,
    domains: params.domains ? params.domains.map(value => value.id).join(';') : null,
    entityTypes: params.entityTypes ? params.entityTypes.map(value => value.id).join(';') : null,
    organism: params.organism,
  };
}

export function createSearchParamsFromQuery(params): SearchParameters {
  return {
    query: params.q,
    domains: getChoicesFromQuery(params, 'domains', DOMAIN_MAP),
    entityTypes: getChoicesFromQuery(params, 'entityTypes', ENTITY_TYPE_MAP),
    organism: params.organism,
    page: params.page != null && params.page.length ? parseInt(params.page, 10) : 1,
    limit: VIZ_SEARCH_LIMIT,
  };
}

function getChoicesFromQuery<T>(params, key, choicesMap: Map<string, T>): T[] {
  if (params.hasOwnProperty(key)) {
    if (params[key] === '') {
      return [];
    } else {
      const choices: T[] = [];
      for (const id of params[key].split(';')) {
        const choice = choicesMap.get(id);
        if (choice != null) {
          choices.push(choice);
        }
      }
      return choices;
    }
  } else {
    return null;
  }
}
