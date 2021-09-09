import visNetwork from 'vis-network';

export interface ValueAccessor {
  description: string;
}

export interface ValueGenerator extends ValueAccessor {
  disabled?: () => boolean;
  preprocessing: (v: SankeyData) => Partial<SankeyData> | undefined;
  postprocessing?: (v: SankeyData) => Partial<SankeyData> | undefined;
}

export interface MultiValueAccessor extends ValueAccessor {
  callback: () => void;
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
  prescalers: ArrayWithDefault<Prescaler>;
  selectedPrescaler: Prescaler;
  selectedNodeValueAccessor: ValueGenerator;
  selectedLinkValueAccessor: ValueGenerator;
  selectedPredefinedValueAccessor: MultiValueAccessor;
  nodeValueAccessors: Array<ValueGenerator>;
  linkValueAccessors: Array<ValueGenerator>;
  predefinedValueAccessors: Array<MultiValueAccessor>;
  nodeValueGenerators: {
    [key: string]: ValueGenerator
  };
  linkValueGenerators: {
    [key: string]: ValueGenerator
  };
  normalizeLinks: boolean;
  linkPalettes: ArrayWithDefault<Palette>;
  selectedLinkPalette: Palette;
  labelEllipsis: {
    enabled: boolean,
    value: number
  } | undefined;
  fontSizeScale: number;
}

interface LinkedNode {
  fromEdges: Array<any>;
  toEdges: Array<any>;
}

export type IntermediateNodeType = visNetwork.Node & SankeyNode & LinkedNode;
