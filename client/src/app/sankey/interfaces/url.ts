export enum SankeyURLLoadParam {
  NETWORK_TRACE_IDX = 'network_trace',
  VIEW_NAME = 'view',
  BASE_VIEW_NAME = 'base_view',
  SEARCH_TERMS = 'search_terms',
}

export interface SankeyURLLoadParams {
  [SankeyURLLoadParam.NETWORK_TRACE_IDX]: number;
  [SankeyURLLoadParam.VIEW_NAME]?: string;
  [SankeyURLLoadParam.BASE_VIEW_NAME]?: string;
  [SankeyURLLoadParam.SEARCH_TERMS]?: string;
}
