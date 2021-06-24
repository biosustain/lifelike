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
}

interface SankeyData {
  nodes?: Array<SankeyNode>;
  links?: Array<SankeyLink>;
}
