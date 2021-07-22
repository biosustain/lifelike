import { linkPalettes } from './color-palette';

export interface ValueGenerator {
  disabled?: () => boolean;
  description: string;
  preprocessing: (v: SankeyData) => Partial<SankeyData> | undefined;
  postprocessing?: (v: SankeyData) => Partial<SankeyData> | undefined;
}

export interface ArrayWithDefault<T> extends Array<T> {
  default?: T;
}

export interface Prescaler {
  name: string;
  description: string;
  fn: (v: number) => number;
}

export interface Palette {
  name: string;
  palette: (size: number, params: object) => (i: number) => string | object;
}

interface SankeyNodeHeight {
  min: {
    enabled: boolean,
    value: number
  };
  max: {
    enabled: boolean,
    ratio: number
  };
}

export interface SankeyAdvancedOptions {
  nodeHeight: SankeyNodeHeight;
  prescalers: Array<any>;
  selectedPrescaler: any;
  selectedNodeValueAccessor: any;
  selectedLinkValueAccessor: any;
  selectedPredefinedValueAccessor: any;
  nodeValueAccessors: Array<any>;
  linkValueAccessors: Array<any>;
  predefinedValueAccessors: Array<any>;
  nodeValueGenerators: Array<any>;
  linkValueGenerators: Array<any>;
  normalizeLinks: boolean;
  linkPalettes: Array<any>;
  selectedLinkPalette: any;
  labelEllipsis: any;
}

import visNetwork from 'vis-network';

interface LinkedNode {
  fromEdges: Array<any>;
  toEdges: Array<any>;
}

export type IntermediateNodeType = visNetwork.Node & SankeyNode & LinkedNode;
