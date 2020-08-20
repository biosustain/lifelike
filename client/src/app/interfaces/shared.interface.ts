export enum Browsers {
  ANDROID = 'android',
  BLINK = 'blink',
  EDGE = 'edge',
  FIREFOX = 'firefox',
  IOS = 'ios',
  SAFARI = 'safari',
  TRIDENT = 'trident',
  WEBKIT = 'webkit',
  UNKNOWN = 'unknown',
}

export enum OperatingSystems {
  LINUX = 'linux',
  MAC = 'mac',
  WINDOWS = 'windows',
  UNKNOWN = 'unknown',
}

export interface Coords2D {
  x: number;
  y: number;
}

export interface PaginatedRequestOptions {
  sort?: string;
  page?: number;
  limit?: number;
}

export interface SearchableRequestOptions {
  q?: string;
}

export type StandardRequestOptions = PaginatedRequestOptions & SearchableRequestOptions;

export interface ResultList<T> {
  total: number;
  results: T[];
}

export interface RankedItem<T> {
  item: T;
  rank: number;
}
