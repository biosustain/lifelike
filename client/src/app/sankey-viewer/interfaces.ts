interface SankeyNode {
  id?: number|string;
  description?: string;
  stId?: string;
  name?: string | Array<string>;
  label?: string;
  labels?: Array<string>;
  type?: string;

  // Temp definitions to fix LL-3499
  sourceLinks?: Array<SankeyLink>;
  targetLinks?: Array<SankeyLink>;
  // End temp definitions

  // region Used internally to compute layout
  _index?: number|string;
  _sourceLinks?: Array<SankeyLink>;
  _targetLinks?: Array<SankeyLink>;
  _y0?: number;
  _y1?: number;
  _x0?: number;
  _x1?: number;
  _depth?: number;
  _height?: number;
  _value?: number;
  _fixedValue?: number;
  _layer?: number;
  _color?: string;

  // endregion

  [key: string]: any;
}

interface SankeyTrace {
  group?: number | string;
  detail_edges?: Array<any>;
  target?: number;
  source?: number;
}

interface SankeyLink {
  index?: number;
  source?: string | number;
  target?: string | number;
  description?: string;

  // region Used internally to compute layout
  _trace?: SankeyTrace;
  _source?: SankeyNode | string | number;
  _target?: SankeyNode | string | number;
  _width?: number;
  _y0?: number;
  _y1?: number;
  _multiple_values?: [number, number];
  _circularLinkID?: number;
  _circular?: boolean;
  _folded?: boolean;
  _value: number;

  // endregion

  [key: string]: any;
}

interface SankeyNodeSets {
  [key: string]: Array<number>;
}

interface SankeyNodeSets {
  // @ts-ignore
  [key: string]: Array<number>;
}

interface SankeySizingGroup {
  link_sizing?: string;
  node_sizing?: string;
}

interface SankeyPredefinedSizing {
  // @ts-ignore
  [key: string]: SankeySizingGroup;
}

interface SankeyGraph {
  log?: string | Array<string>;
  description: string;
  node_sets: SankeyNodeSets;
  sizing?: SankeyPredefinedSizing;
}

interface SankeyD3Data {
  nodes: Array<SankeyNode>;
  links: Array<SankeyLink>;
}

interface SankeyData extends SankeyD3Data {
  graph: SankeyGraph;

  // region used internally to compute layout
  _inNodes?: Array<number>;
  _outNodes?: Array<number>;
  // endregion
}
