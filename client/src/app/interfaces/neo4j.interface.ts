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

export interface Neo4jResults {
  nodes: Array<{[key: string]: any}>;
  edges: Array<{[key: string]: any}>;
}
