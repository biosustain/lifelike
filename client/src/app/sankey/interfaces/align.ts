import { SankeyNode } from './pure';
import { PropertyDictionary, FunctionProperty } from './property';

export interface Align extends FunctionProperty {
  fn: (node: SankeyNode, n: number) => number;
}

export enum ALIGN_ID {
  left = 'left',
  right = 'right',
  center = 'center',
  justify = 'justify',
}

export type ALIGNS = PropertyDictionary<ALIGN_ID, Align>;
