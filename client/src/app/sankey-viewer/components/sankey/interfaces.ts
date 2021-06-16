interface Node {
  index?: number;
  sourceLinks?: Array<Link>;
  targetLinks?: Array<Link>;
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
}

interface Link {
  index?: number;
  source?: Node | string | number;
  target?: Node | string | number;
  width?: number;
  y0?: number;
  y1?: number;
  _multiple_values?: [number, number];
  circularLinkID?: number;
  circular?: boolean;
  _folded?: boolean;
}

interface SankeyData {
  nodes?: Array<Node>;
  links?: Array<Link>;
}
