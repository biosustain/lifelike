export interface ColumnNameIndex {
  // key is column name
  // value is column index
  [key: string]: number;
}

// parsed worksheet sheet name and sheet column names
export interface SheetNameAndColumnNames {
  sheetName: string;
  sheetColumnNames: ColumnNameIndex[];
}

export interface FileNameAndSheets {
  sheets: SheetNameAndColumnNames[];
  filename: string;
}

export interface Neo4jNodeMapping {
  nodeLabel: { [key: number]: string};
  nodeProperties: { [key: number]: string}[];
}

export interface Neo4jEdgeMapping {
  edgeLabel: { [key: number]: string};
  edgeProperties?: { [key: number]: string}[];
}

export interface Neo4jColumnMapping {
  sourceNode: Neo4jNodeMapping;
  targetNode: Neo4jNodeMapping;
  edge: number; // just the column index for now // Neo4jEdgeMapping;
  fileName: string;
  sheetName: string;
}

/** Node representation from the backend */
export interface GraphNode {
  id: number;
  label: string;
  data: {[key: string]: any};
  subLabels: Array<string>;
  displayName: string;
}

/** Edge represenattion from the backend */
export interface GraphRelationship {
  id: number;
  label: string;
  data: {[key: string]: any};
  to: number;
  from: number;
}

/** VisJS Node Representations for Client */
export interface VisNode extends GraphNode {
  primaryLabel?: string; // Label to display in VisJS
  expanded?: boolean; // Whether a node has been expanded
  duplicateOf?: number | null;
}

/** VisJS Edge Representations for Client */
export interface VisEdge extends GraphRelationship {
  arrows?: string;
  duplicateOf?: number | null;
  originalFrom?: number | null;
  originalTo?: number | null;
}

export interface Neo4jResults {
  nodes: Array<GraphNode | VisNode>;
  edges: Array<GraphRelationship | VisEdge>;
}

// Used for vis.js configuration
// https://visjs.github.io/vis-network/docs/network/configure.html#
export interface Neo4jGraphConfig {
  [key: string]: any;
}
