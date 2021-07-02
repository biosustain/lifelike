import { SearchType } from './shared';
import { StandardRequestOptions } from 'app/shared/schemas/common';

export interface ContentSearchOptions extends StandardRequestOptions {
  types?: SearchType[];
  projects?: string[];
}
