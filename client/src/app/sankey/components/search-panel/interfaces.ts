import { Match } from '../../services/search-match';

export interface SearchEntity {
  nodeId?: string | number;
  linkId?: string | number;
  calculatedMatches: Match[];
  term: string;
}
