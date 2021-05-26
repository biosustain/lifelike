import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemObjectData } from 'app/file-browser/schema';
import { RankedItem, ResultList, StandardRequestOptions } from 'app/shared/schemas/common';

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

export interface ContentSearchResponse extends ResultList<RankedItem<FilesystemObject>> {
  synonyms: {
    [***ARANGO_USERNAME***Word: string]: string[]
  };
  droppedSynonyms: {
    [***ARANGO_USERNAME***Word: string]: string[]
  };
}

// Need an extra interface to accommodate the legacy data
export interface ContentSearchResponseData extends ResultList<RankedItem<FilesystemObjectData>> {
  synonyms: {
    [***ARANGO_USERNAME***Word: string]: string[]
  };
  droppedSynonyms: {
    [***ARANGO_USERNAME***Word: string]: string[]
  };
}
