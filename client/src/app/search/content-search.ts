import { SearchType } from './shared';
import { StandardRequestOptions } from '../shared/schemas/common';

export interface ContentSearchOptions extends StandardRequestOptions {
  mimeTypes: SearchType[];
}

export interface AnnotationRequestOptions {
  texts: string[];
}

export interface AnnotationResponse {
  texts: string[];
}
