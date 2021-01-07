import { SearchType } from './shared';
import { StandardRequestOptions } from '../shared/schemas/common';
import { MAP_MIMETYPE } from '../drawing-tool/providers/map-type-provider';
import { PDF_MIMETYPE } from '../pdf-viewer/providers/pdf-type-provider';
import { DIRECTORY_MIMETYPE } from '../file-browser/providers/directory-type-provider';

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
