import { SankeyLink, Trace, SankeyNode, SankeyTraceLink } from 'app/sankey/model/SankeyDocument';

import { LINK_PALETTES } from './color-palette';
import { SankeyBaseState, SankeyBaseOptions } from '../interfaces';
import { SankeyId, NetworkTraceData, TypeContext } from '../../interfaces';

export interface SankeyMultiLaneOptions extends SankeyBaseOptions {
  linkPalettes: LINK_PALETTES;
}

export interface SankeyMultiLaneState extends SankeyBaseState {
  linkPaletteId: string;
}

export type BaseOptions = SankeyMultiLaneOptions;
export type BaseState = SankeyMultiLaneState;

export interface Base extends TypeContext {
  options: BaseOptions;
  state: BaseState;
  link: SankeyTraceLink;
  node: SankeyNode<this['link']>;
}

export type MultiLaneNetworkTraceData = NetworkTraceData<Base>;
