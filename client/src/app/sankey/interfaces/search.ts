import Graph from 'app/shared/providers/graph-type/interfaces';
import { MatchPriority } from 'app/shared/utils/find/prioritised-find';

import { SankeyId } from './pure';

export interface SearchLink extends Graph.Link {
  id: SankeyId;
}

export interface SearchNode extends Graph.Node {
  id: number;
}

export enum EntityType {
  Link = 'link',
  Node = 'node',
  Trace = 'trace',
}

export interface Match {
  idx?: number;
  type: EntityType;
  id: SankeyId;
  path: string[];
  term: string | number;
  priority: MatchPriority;
  networkTraceIdx?: number;
}

export interface MatchGenerator {
  type: EntityType;
  id: SankeyId;
  matchGenerator: Generator<Match>;
}
