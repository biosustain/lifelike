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
}
