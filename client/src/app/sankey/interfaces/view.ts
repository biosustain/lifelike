import { RecursivePartial } from 'app/shared/schemas/common';

import { SankeyState } from './index';

export type SankeyLinksOverwrites = Record<string, SavedLinkProperties>;

interface SavedNodeProperties {
  y0: number;
  x0: number;
  order: number;
}

interface SavedLinkProperties {
  order: number;
}

export type SankeyNodesOverwrites = Record<string, SavedNodeProperties>;

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
