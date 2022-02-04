import { LINK_PALETTES } from './color-palette';
import { SankeyBaseState, SankeyBaseOptions } from '../interfaces';

export interface SankeyMultiLaneOptions extends SankeyBaseOptions {
  linkPalettes: LINK_PALETTES;
}

// tslint:disable-next-line:no-empty-interface
export interface SankeyMultiLaneState extends SankeyBaseState {
  linkPaletteId: string;
}
