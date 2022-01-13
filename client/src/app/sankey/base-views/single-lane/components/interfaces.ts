import {
  SankeyLink,
  SankeyState,
  SankeyNode,
  SankeyData,
  SankeyTrace,
  SelectionType,
  SelectionEntity,
  SankeyOptions
} from 'app/sankey/interfaces';

export interface SankeySingleLaneStateExtend {
  highlightCircular: boolean;
  colorLinkByType: boolean;
  linkPaletteId: string;
}

export type SankeySingleLaneState = SankeyState & SankeySingleLaneStateExtend;

export interface SankeySingleLaneOptionsExtend {
  colorLinkTypes: { [type: string]: string };
}

export type SankeySingleLaneOptions = SankeyOptions & SankeySingleLaneOptionsExtend;

export interface SankeySingleLaneLink extends SankeyLink {
  _graphRelativePosition?: 'left' | 'right' | 'multiple';
  _visited?: string | number;
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


// region Selection
export type SelectionSingleLaneEntity = SelectionEntity | {
  [SelectionType.link]: SankeySingleLaneLink;
};
// endregion

export type SankeySingleLaneSelection = {
  node: SankeySingleLaneNode
} | {
  link: SankeySingleLaneLink
} | {
  trace: SankeyTrace
};
