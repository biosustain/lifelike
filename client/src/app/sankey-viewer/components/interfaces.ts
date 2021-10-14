export interface ValueAccessor {
  description: string;
  help?: string;
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
  help?: string;
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

// Add properties used internally to compute layout
export interface SankeyNode extends GraphNode {
  // Temp definitions to fix LL-3499
  sourceLinks?: Array<SankeyLink>;
  targetLinks?: Array<SankeyLink>;
  // End temp definitions

  _index?: number | string;
  _sourceLinks?: Array<SankeyLink>;
  _targetLinks?: Array<SankeyLink>;
  _y0?: number;
  _y1?: number;
  _x0?: number;
  _x1?: number;
  _depth?: number;
  _reversedDepth?: number;
  _height?: number;
  _value?: number;
  _fixedValue?: number;
  _layer?: number;
  _color?: string;
}

// Add properties used internally to compute layout
export interface SankeyLink extends GraphLink {
  _id: string;
  _trace?: GraphTrace;
  _source?: SankeyNode | string | number;
  _target?: SankeyNode | string | number;
  _sourceLinks?: SankeyLink[];
  _targetLinks?: SankeyLink[];
  _width?: number;
  _y0?: number;
  _y1?: number;
  _multiple_values?: [number, number];
  _circularLinkID?: number;
  _circular?: boolean;
  _folded?: boolean;
  _value: number;
}

export interface SankeyTrace extends GraphTrace {
  _color: string;
}

export interface SankeyTraceNetwork extends GraphTraceNetwork {
  traces: Array<SankeyTrace>;
}

export interface SankeyGraph extends GraphGraph {
  trace_networks: Array<SankeyTraceNetwork>;
}

// Add properties used internally to compute layout
export interface SankeyData extends GraphFile {
  graph: SankeyGraph;
  nodes: Array<SankeyNode>;
  links: Array<SankeyLink>;

  _inNodes?: Array<number>;
  _outNodes?: Array<number>;
}

export interface SelectionEntity {
  type: string;
  entity: SankeyLink | SankeyNode | SankeyTrace;
}

export interface SankeyPathReportEntity {
  label: string;
  row: number;
  column: number;
  type: 'node' | 'link' | 'spacer';
}

export interface SankeyPathReport {
  [networkTrace: string]: SankeyPathReportEntity[][];
}
