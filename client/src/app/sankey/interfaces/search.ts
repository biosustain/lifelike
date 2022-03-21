import { GraphNode, GraphLink } from 'app/shared/providers/graph-type/interfaces';
import { MatchPriority } from 'app/shared/utils/find/prioritised-find';

import { SankeyId } from './pure';

export interface SearchLink extends GraphLink {
  _id: SankeyId;
}

export interface SearchNode extends GraphNode {
  _id: SankeyId;
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
