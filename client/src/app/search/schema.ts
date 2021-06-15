import { StandardRequestOptions } from 'app/shared/schemas/common';

import { SynonymData } from './shared';

// ========================================
// Content Search
// ========================================

// Requests
// ----------------------------------------

export interface ContentSearchRequest extends StandardRequestOptions {
  types?: string[];
  projects?: string[];
}

export interface AnnotationRequestOptions {
  texts: string[];
}

// Responses
// ----------------------------------------

export interface AnnotationResponse {
  texts: string[];
}

export interface SynonymSearchResponse {
  synonyms: SynonymData[];
  count: number;
}
