import { SearchType } from './shared';
import { StandardRequestOptions } from '../interfaces/shared.interface';

export const TYPES: readonly SearchType[] = Object.freeze([
  Object.freeze({id: 'maps', name: 'Maps'}),
  Object.freeze({id: 'documents', name: 'Documents'}),
]);

export const TYPES_MAP: Map<string, SearchType> = new Map(Array.from(TYPES.values()).map(value => [value.id, value]));

export interface ContentSearchOptions extends StandardRequestOptions {
  types: SearchType[];
}
