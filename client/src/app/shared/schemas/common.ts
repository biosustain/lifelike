export interface PaginatedRequestOptions {
  sort?: string;
  page?: number;
  limit?: number;
}

export interface SearchableRequestOptions {
  q?: string;
}

export type StandardRequestOptions = PaginatedRequestOptions & SearchableRequestOptions;

export interface RankedItem<T> {
  item: T;
  rank: number;
}

export interface ResultQuery {
  phrases: string[];
}

export interface SingleResult<T> {
  result: T;
}

export interface ResultMapping<T> {
  mapping?: { [key: string]: T };
  missing: string[];
  results?: { [key: string]: T };
}

export interface ResultList<T> {
  total: number;
  results: T[];
  query?: ResultQuery;
}

export interface ErrorResponse {
  message: string;
  detail?: string;
  code?: 'validation' | 'permission';
  apiHttpError?: {
    name: string;
    message: string;
  };
  version?: string;
  transactionId?: string;
  fields?: { [key: string]: string[] };
}

export interface ErrorLogMeta {
  label: string;
  expected?: boolean;
  url?: string;
}

export interface ErrorLog extends ErrorLogMeta {
  title: string;
  message: string;
  detail?: string;
  transactionId: string;
}
