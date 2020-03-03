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
  nodeType: string;
  nodeProperties: { [key: number]: string };
  mappedNodeType: string;
  mappedNodeProperty: string;  // { [key: number]: string };
  uniqueProperty: string;
}

/**
 * The use of numbers represent the column index used to filter.
 */
export interface Neo4jRelationshipMapping {
  edge: string;
  edgeProperty: { [key: number]: string };
  sourceNode: {
    mappedNodeType: string;
    mappedNodeProperty: { [key: number]: string };
  };
  targetNode: {
    mappedNodeType: string;
    mappedNodeProperty: { [key: number]: string };
  };
}

export interface Neo4jColumnMapping {
  node: Neo4jNodeMapping;
  relationship: Neo4jRelationshipMapping;
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
  color: any; // VisJS color options
  expanded?: boolean; // Whether a node has been expanded
}

export interface DuplicateVisNode extends VisNode {
    id: any;
    duplicateOf: number;
}

/** VisJS Edge Representations for Client */
export interface VisEdge extends GraphRelationship {
  arrows?: string;
}

export interface DuplicateVisEdge extends VisEdge {
    id: any;
    duplicateOf: number | null;
    originalFrom: number | null;
    originalTo: number | null;
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
