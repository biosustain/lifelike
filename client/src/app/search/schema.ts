import { StandardRequestOptions } from '../shared/schemas/common';

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
}

// ========================================
// Content Search
// ========================================

// Requests
// ----------------------------------------

export interface AnnotationRequest {
  texts: string[];
}

// Responses
// ----------------------------------------

export interface AnnotationResponse {
  texts: string[];
}
