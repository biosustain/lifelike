import { LINK_PALETTES } from './color-palette';
import { SankeyBaseState, SankeyBaseOptions } from '../interfaces';
import { SankeyLink, SankeyTrace, SankeyNode, SankeyId } from '../../pure_interfaces';
import { NetworkTraceData } from '../../interfaces';

export interface SankeyMultiLaneOptions extends SankeyBaseOptions {
  linkPalettes: LINK_PALETTES;
}

export interface SankeyMultiLaneState extends SankeyBaseState {
  linkPaletteId: string;
}

export type BaseOptions = SankeyMultiLaneOptions;
export type BaseState = SankeyMultiLaneState;

export interface SankeyMultiLaneLink extends SankeyLink {
  _trace?: SankeyTrace;
  _originLinkId?: SankeyId;
}

export interface SankeyMultiLaneNode extends SankeyNode {
  _sourceLinks?: Array<SankeyMultiLaneLink>;
  _targetLinks?: Array<SankeyMultiLaneLink>;
}

export type MultiLaneNetworkTraceData = NetworkTraceData<SankeyMultiLaneNode, SankeyMultiLaneLink>;
