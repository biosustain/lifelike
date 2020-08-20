import { DOMAIN_MAP, ENTITY_TYPE_MAP } from '../../shared/database';
import { VIZ_SEARCH_LIMIT } from '../../shared/constants';
import { GraphSearchParameters } from '../graph-search';
import { getChoicesFromQuery } from '../../shared/utils/params';

export function getQueryParams(params: GraphSearchParameters) {
  return {
    q: params.query,
    page: params.page,
    domains: params.domains ? params.domains.map(value => value.id).join(';') : null,
    entityTypes: params.entityTypes ? params.entityTypes.map(value => value.id).join(';') : null,
  };
}

export function createSearchParamsFromQuery(params): GraphSearchParameters {
  return {
    query: params.q,
    domains: getChoicesFromQuery(params, 'domains', DOMAIN_MAP),
    entityTypes: getChoicesFromQuery(params, 'entityTypes', ENTITY_TYPE_MAP),
    page: params.page != null && params.page.length ? parseInt(params.page, 10) : 1,
    limit: VIZ_SEARCH_LIMIT,
  };
}

