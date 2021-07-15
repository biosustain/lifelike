interface SankeyNode {
  id?: number;
  index?: number;
  sourceLinks?: Array<SankeyLink>;
  targetLinks?: Array<SankeyLink>;
  y0?: number;
  y1?: number;
  x0?: number;
  x1?: number;
  depth?: number;
  height?: number;
  value?: number;
  fixedValue?: number;
  layer?: number;
  description?: string;
  _color?: string;
  _selected?: boolean;
  stId?: string;
  name?: string | Array<string>;
  label?: string;
  type?: string;
}

interface SankeyLink {
  index?: number;
  source?: SankeyNode | string | number;
  target?: SankeyNode | string | number;
  width?: number;
  y0?: number;
  y1?: number;
  _multiple_values?: [number, number];
  circularLinkID?: number;
  circular?: boolean;
  _folded?: boolean;
  value: number;
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
  inNodes?: Array<number>;
  outNodes?: Array<number>;
}
