import { Match } from '../../services/search-match';

export interface SearchEntity {
  networkTraceIdx?: number;
  nodeId?: string | number;
  linkId?: string | number;
  calculatedMatches: Match[];
  term: string;
}
