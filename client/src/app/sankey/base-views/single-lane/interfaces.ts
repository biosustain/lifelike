import { SankeyData, SelectionType, SelectionEntity, SankeyNode, SankeyTrace, SankeyLink } from 'app/sankey/interfaces';

import { SankeyBaseState, SankeyBaseOptions } from '../interfaces';

export interface SankeySingleLaneStateExtend {
  highlightCircular: boolean;
  colorLinkByType: boolean;
}

export type SankeySingleLaneState = SankeyBaseState & SankeySingleLaneStateExtend;

export interface SankeySingleLaneOptionsExtend {
  colorLinkTypes: { [type: string]: string };
}

export type SankeySingleLaneOptions = SankeyBaseOptions & SankeySingleLaneOptionsExtend;

export interface SankeySingleLaneLink extends SankeyLink {
  _graphRelativePosition?: 'left' | 'right' | 'multiple';
  _visited?: string | number;
  _originLinkId?: string;
  _traces?: SankeyTrace[];
}

export interface SankeySingleLaneNode extends SankeyNode {
  _source: SankeySingleLaneLink;
  _target: SankeySingleLaneLink;
}

export interface SankeySingleLaneData extends SankeyData {
  links: SankeySingleLaneLink[];
  nodes: SankeySingleLaneNode[];
}

export type SelectionSingleLaneEntity = SelectionEntity | {
  [SelectionType.link]: SankeySingleLaneLink;
};

export type SankeySingleLaneSelection = {
  node: SankeySingleLaneNode
} | {
  link: SankeySingleLaneLink
} | {
  trace: SankeyTrace
};

export type BaseOptions = SankeySingleLaneOptions;
export type BaseState = SankeySingleLaneState;
