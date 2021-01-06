import { SearchType } from './shared';
import { StandardRequestOptions } from '../shared/schemas/common';
import {
  DIRECTORY_MIMETYPE,
  MAP_MIMETYPE,
  PDF_MIMETYPE,
} from '../file-browser/models/filesystem-object';

export const TYPES: readonly SearchType[] = Object.freeze([
  Object.freeze({id: MAP_MIMETYPE, name: 'Maps'}),
  Object.freeze({id: PDF_MIMETYPE, name: 'Documents'}),
]);

export const TYPES_MAP: Map<string, SearchType> = new Map(Array.from(TYPES.values()).map(value => [value.id, value]));

export interface ContentSearchOptions extends StandardRequestOptions {
  mimeTypes: SearchType[];
}

export interface AnnotationRequestOptions {
  texts: string[];
}

export interface AnnotationResponse {
  texts: string[];
}
