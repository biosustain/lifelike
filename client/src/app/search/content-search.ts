import { SearchType } from './shared';
import { StandardRequestOptions } from 'app/shared/schemas/common';

export interface ContentSearchOptions extends StandardRequestOptions {
  types?: SearchType[];
  projects?: string[];
  phrase?: string;
  wildcards?: string;
  synonyms?: boolean;
}
