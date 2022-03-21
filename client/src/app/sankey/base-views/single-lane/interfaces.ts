import { SankeyFile, SankeyNode, SankeyTrace, SankeyLink, NetworkTraceData } from 'app/sankey/interfaces';

import { SankeyBaseState, SankeyBaseOptions } from '../interfaces';
import { SelectionEntity, SelectionType } from '../../interfaces/selection';


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
  _traces?: SankeyTrace[];
}

export interface SankeySingleLaneNode extends SankeyNode {
  _source: SankeySingleLaneLink;
  _target: SankeySingleLaneLink;
}

export interface SankeySingleLaneData extends SankeyFile {
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

export type SingleLaneNetworkTraceData = NetworkTraceData<SankeySingleLaneNode, SankeySingleLaneLink>;

export interface Palette {
  name: string;
  palette: (size: number, params: object) => (i: number) => string | object;
  help?: string;
}
