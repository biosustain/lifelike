import { PRESCALERS } from 'app/sankey-viewer/components/algorithms/prescalers';
import { LINK_PALETTES } from 'app/sankey-viewer/components/color-palette';

// region UI options
export interface ValueAccessor {
  description: string;
  help?: string;
}

export interface IntermediateProcessedData extends Partial<SankeyData> {
  _sets: object;
}

export interface ValueGenerator extends ValueAccessor {
  disabled?: () => boolean;
  preprocessing: (v: SankeyData) => IntermediateProcessedData | undefined;
  postprocessing?: (v: SankeyData) => IntermediateProcessedData | undefined;
}

export interface MultiValueAccessor extends ValueAccessor {
  callback: () => void;
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

export interface NodeValueAccessor {
  [nodeValuePropertyName: string]: ValueGenerator;
}

export interface LinkValueAccessor {
  [linkValuePropertyName: string]: ValueGenerator;
}

export type PREDEFINED_VALUE_ACCESSORS = {
  [linkValueGeneratorId in PREDEFINED_VALUE]: MultiValueAccessor
};

export enum LINK_VALUE_GENERATOR {
  fixedValue0 = 'Fixed Value = 0',
  fixedValue1 = 'Fixed Value = 1',
  input_count = 'Input count',
  fraction_of_fixed_node_value = 'Fraction of fixed node value',
}

type LINK_VALUE_GENERATORS = {
  [linkValueGeneratorId in LINK_VALUE_GENERATOR]: ValueGenerator
};

type NODE_VALUE_GENERATORS = {
  [linkValueGeneratorId in NODE_VALUE_GENERATOR]: ValueGenerator
};

export enum NODE_VALUE_GENERATOR {
  none = 'None',
  fixedValue1 = 'Fixed Value = 1'
}

export enum PREDEFINED_VALUE {
  fixed_height = 'Fixed height',
  input_count = 'Input count'
}

export interface SankeyOptions {
  networkTraces: Array<SankeyTraceNetwork>;
  prescalers: PRESCALERS;
  nodeValueAccessors: NodeValueAccessor;
  linkValueAccessors: LinkValueAccessor;
  predefinedValueAccessors: PREDEFINED_VALUE_ACCESSORS;
  nodeValueGenerators: NODE_VALUE_GENERATORS;
  linkValueGenerators: LINK_VALUE_GENERATORS;
  linkPalettes: LINK_PALETTES;
}

export interface SankeyState {
  nodeAlign: 'right' | 'left';
  networkTraceIdx: number;
  nodeHeight: SankeyNodeHeight;
  prescalerId: string;
  nodeValueAccessorId: string;
  linkValueAccessorId: string;
  predefinedValueAccessorId: string;
  normalizeLinks: boolean;
  linkPaletteId: string;
  labelEllipsis: {
    enabled: boolean,
    value: number
  } | undefined;
  fontSizeScale: number;
}

// endregion

// region Graph as Sankey
// Add properties used internally to compute layout
export type SankeyId = string;

export interface SankeyNode extends GraphNode {
  // Temp definitions to fix LL-3499
  sourceLinks?: Array<SankeyLink>;
  targetLinks?: Array<SankeyLink>;
  // End temp definitions

  _id: SankeyId;
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
  _order?: number;
}

export interface SankeyLink extends GraphLink {
  l: number[];
  _id: SankeyId;
  _trace?: SankeyTrace;
  _source?: SankeyNode | string | number;
  _target?: SankeyNode | string | number;
  _sourceLinks?: SankeyLink[];
  _targetLinks?: SankeyLink[];
  _width?: number;
  _y0?: number;
  _y1?: number;
  _multiple_values?: [number, number];
  _adjacent_divider?: number;
  _circularLinkID?: number;
  _circular?: boolean;
  _folded?: boolean;
  _value: number;
  _order?: number;
}

export interface SankeyTrace extends GraphTrace {
  _color: string;
  _group: GraphTrace['group'] | string;
}

export interface SankeyTraceNetwork extends GraphTraceNetwork {
  traces: Array<SankeyTrace>;
}

export interface SankeyGraph extends GraphGraph {
  trace_networks: Array<SankeyTraceNetwork>;
}

export interface SankeyLinksOverwrites {
  [linkId: string]: Partial<GraphLink>;
}

export interface SankeyNodesOverwrites {
  [nodeId: string]: Partial<GraphNode>;
}

export interface SankeyView {
  state: object & SankeyState;
  base: string;
  nodes: SankeyNodesOverwrites;
  links: SankeyLinksOverwrites;
}

export interface SankeyViews {
  [viewName: string]: SankeyView;
}

export interface SankeyData extends GraphFile {
  graph: SankeyGraph;
  nodes: Array<SankeyNode>;
  links: Array<SankeyLink>;

  _inNodes?: Array<number>;
  _outNodes?: Array<number>;

  _views: SankeyViews;
}

// endregion

export enum SankeyURLLoadParam {
  NETWORK_TRACE_IDX = 'network_trace',
  VIEW_NAME = 'view_name'
}

export interface SankeyURLLoadParams {
  [SankeyURLLoadParam.NETWORK_TRACE_IDX]: number;
  [SankeyURLLoadParam.VIEW_NAME]?: string;
}

// region Selection
export enum SelectionType {
  // assign values to use in template
  link = 'link',
  node = 'node',
  trace = 'trace'
}

export type SelectionEntity = {
  [SelectionType.link]: SankeyLink;
} | {
  [SelectionType.node]: SankeyNode;
} | {
  [SelectionType.trace]: SankeyTrace;
};

// endregion

// region Path report
export interface SankeyPathReportEntity {
  label: string;
  row: number;
  column: number;
  type: 'node' | 'link' | 'spacer';
}

export interface SankeyPathReport {
  [networkTrace: string]: SankeyPathReportEntity[][];
}

// endregion
