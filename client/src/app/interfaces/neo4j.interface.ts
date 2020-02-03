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
