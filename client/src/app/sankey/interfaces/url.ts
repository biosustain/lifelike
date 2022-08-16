export enum SankeyURLLoadParam {
  NETWORK_TRACE_IDX = 'network_trace',
  VIEW_NAME = 'view',
  BASE_VIEW_NAME = 'base_view',
  SEARCH_TERMS = 'search_terms',
}

export type SankeyURLLoadParams = Record<SankeyURLLoadParam, string>;
