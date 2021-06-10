import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemObjectData } from 'app/file-browser/schema';
import { RankedItem, ResultList, StandardRequestOptions } from 'app/shared/schemas/common';

import { SynonymData } from './shared';

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
    [rootWord: string]: string[]
  };
  droppedSynonyms: {
    [rootWord: string]: string[]
  };
}

// Need an extra interface to accommodate the legacy data
export interface ContentSearchResponseData extends ResultList<RankedItem<FilesystemObjectData>> {
  synonyms: {
    [rootWord: string]: string[]
  };
  droppedSynonyms: {
    [rootWord: string]: string[]
  };
}

export interface SynonymSearchResponse {
  synonyms: SynonymData[];
}
