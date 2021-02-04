import { SearchType } from './shared';
import { StandardRequestOptions } from '../shared/schemas/common';

export const TYPES: readonly SearchType[] = Object.freeze([
  Object.freeze({id: 'map', name: 'Maps'}),
  Object.freeze({id: 'pdf', name: 'Documents'}),
]);

export const TYPES_MAP: Map<string, SearchType> = new Map(Array.from(TYPES.values()).map(value => [value.id, value]));

export interface ContentSearchOptions extends StandardRequestOptions {
  types?: SearchType[];
  projects?: string[];
  phrase?: string;
  wildcards?: string;
}

export interface AnnotationRequestOptions {
  texts: string[];
}

export interface AnnotationResponse {
  texts: string[];
}

export interface Project {
  creationDate: string;
  description: string;
  id: number;
  modifiedDate: string;
  projectName: string;
  users: string[];
}
