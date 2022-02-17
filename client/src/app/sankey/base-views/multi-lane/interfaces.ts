import { LINK_PALETTES } from './color-palette';
import { SankeyBaseState, SankeyBaseOptions } from '../interfaces';
import { SankeyLink, SankeyTrace, SankeyNode } from '../../pure_interfaces';

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
}

export interface SankeyMultiLaneNode extends SankeyNode {
  _sourceLinks?: Array<SankeyMultiLaneLink>;
  _targetLinks?: Array<SankeyMultiLaneLink>;
}
