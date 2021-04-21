import { StandardRequestOptions } from 'app/shared/schemas/common';

// ========================================
// Content Search
// ========================================

// Requests
// ----------------------------------------

export interface ContentSearchRequest extends StandardRequestOptions {
  types?: string[];
  projects?: string[];
  phrase?: string;
  wildcards?: string;
  synonyms?: boolean;
}

export interface AnnotationRequestOptions {
  texts: string[];
}

// Responses
// ----------------------------------------

export interface AnnotationResponse {
  texts: string[];
}
