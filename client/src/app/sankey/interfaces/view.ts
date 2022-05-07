import { GraphNode, GraphLink } from 'app/shared/providers/graph-type/interfaces';
import { RecursivePartial } from 'app/shared/schemas/common';

import { SankeyState, ViewBase } from './index';

export type SankeyLinksOverwrites = Record<string, Partial<GraphLink>>;

export type SankeyNodesOverwrites = Record<string, Partial<GraphNode>>;

export interface ViewSize {
  width: number;
  height: number;
}

export interface SankeyView {
  state: object & SankeyState;
  size: ViewSize;
  nodes: SankeyNodesOverwrites;
  links: SankeyLinksOverwrites;
}

export type SankeyApplicableView = RecursivePartial<SankeyView>;

export interface SankeyViews {
  [viewName: string]: SankeyView;
}
