import { SearchType } from './shared';
import { StandardRequestOptions } from 'app/shared/schemas/common';

export interface ContentSearchOptions extends StandardRequestOptions {
  types?: SearchType[]; // NOTE: This is a different type definition than the ContentSearchRequest interface!
  folders?: string[];
  phrase?: string;
  wildcards?: string;
  synonyms?: boolean;
}
