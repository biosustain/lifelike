import { PropertyDictionary, FunctionProperty } from './property';
import { SankeyNode } from '../model/sankey-document';

export interface Align extends FunctionProperty {
  fn: (node: SankeyNode, n: number) => number;
}

export enum ALIGN_ID {
  left = 'left',
  right = 'right',
  // center = 'center',
  justify = 'justify',
}

export type ALIGNS = PropertyDictionary<ALIGN_ID, Align>;
