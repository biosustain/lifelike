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
  expanded?: boolean; // Whether a node has been expanded
}

/** VisJS Edge Representations for Client */
export interface VisEdge extends GraphRelationship {
  arrows?: string;
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

export interface ReferenceTableRow {
    displayName: string;
    nodeId: number;
}

export interface AssociationData {
    nodeId: number;
    description: string;
    entryText: string;
}

export interface AssociationSentence {
    entry1Text: string;
    entry2Text: string;
    id: string;
    score: number;
    sentence: string;
}

export interface FTSQueryRecord {
  node: GraphNode;
  score: number;
}

export interface FTSReferenceRecord extends FTSQueryRecord {
  publicationTitle: string;
  publicationYear: number;
  publicationId: number;
  relationship: string;
  chemical?: GraphNode;
  disease?: GraphNode;
}

export interface FTSResult {
  query: string;
  nodes: Array<FTSQueryRecord>;
  total: number;
  page: number;
  limit: number;
}

export interface SearchQuery {
  query: string;
  page: number;
  limit: number;
}

export interface SearchRecord {
  nodeId: number;
  label: string;
  subLabels: Array<string>;
  data: string;
  dataId: string;
}

