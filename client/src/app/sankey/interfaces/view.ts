import { GraphNode, GraphLink } from 'app/shared/providers/graph-type/interfaces';
import { RecursivePartial } from 'app/shared/schemas/common';

import { SankeyState, ViewBase } from './index';

export interface SankeyLinksOverwrites {
  [linkId: string]: Partial<GraphLink>;
}

export interface SankeyNodesOverwrites {
  [nodeId: string]: Partial<GraphNode>;
}

export interface ViewSize {
  width: number;
  height: number;
}

export interface SankeyView {
  state: object & SankeyState;
  base: ViewBase;
  size: ViewSize;
  nodes: SankeyNodesOverwrites;
  links: SankeyLinksOverwrites;
}

export type SankeyApplicableView = RecursivePartial<SankeyView> & Pick<SankeyView, 'base'>;

export interface SankeyViews {
  [viewName: string]: SankeyView;
}
