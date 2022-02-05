import { LINK_PALETTES } from './color-palette';
import { SankeyBaseState, SankeyBaseOptions } from '../interfaces';

export interface SankeyMultiLaneOptions extends SankeyBaseOptions {
  linkPalettes: LINK_PALETTES;
}

export interface SankeyMultiLaneState extends SankeyBaseState {
  linkPaletteId: string;
}
