import { Match } from 'app/sankey/interfaces/search';

export interface SearchEntity {
  nodeId?: string | number;
  linkId?: string | number;
  calculatedMatches: Match[];
  term: string;
}
