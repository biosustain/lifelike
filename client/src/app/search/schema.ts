import { StandardRequestOptions } from '../shared/schemas/common';

// ========================================
// Content Search
// ========================================

// Requests
// ----------------------------------------

export interface ContentSearchRequest extends StandardRequestOptions {
  mimeTypes?: string[];
}
