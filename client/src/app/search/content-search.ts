import { SearchType } from './shared';
import { StandardRequestOptions } from '../shared/schemas/common';

export interface ContentSearchOptions extends StandardRequestOptions {
  types?: SearchType[];
  projects?: string[];
  phrase?: string;
  wildcards?: string;
}
