export interface ColumnNameIndex {
  // key is column name
  // value is column index
  [key: string]: number;
}

export interface SheetRowPreview {
  [key: string]: string;
}

export interface NodeMappingHelper {
  worksheetDomain: string;
  mapping: {
    existingMappings: {[key: number]: Neo4jNodeMapping};
    newMappings: {[key: number]: Neo4jNodeMapping};
  };
}

// parsed worksheet sheet name and sheet column names
export interface SheetNameAndColumnNames {
  sheetName: string;
  sheetColumnNames: ColumnNameIndex[];
  sheetPreview: SheetRowPreview[];
}

export interface FileNameAndSheets {
  sheets: SheetNameAndColumnNames[];
  filename: string;
}

export interface Neo4jNodeMapping {
  edge?: string;
  nodeType?: string;
  nodeProperties?: { [key: number]: string };
  mappedNodeType: string;
  mappedNodePropertyFrom: string;  // { [key: number]: string };
  mappedNodePropertyTo: string;
  uniqueProperty?: string;  // the unique prop to filter on in Neo4j to create relationship between
  // newly created nodes
}

/**
 * The use of numbers represent the column index used to filter.
 */
export interface Neo4jRelationshipMapping {
  edge: { [key: number]: string };  // if newly created edge (i.e user input) set key to negative number
  edgeProperty: { [key: number]: string };
  sourceNode: Neo4jNodeMapping;
  targetNode: Neo4jNodeMapping;
}

export interface Neo4jColumnMapping {
  newNodes: Neo4jNodeMapping[];
  existingNodes: Neo4jNodeMapping[];
  relationships: Neo4jRelationshipMapping[];
  domain: string;
  fileName: string;
  sheetName: string;
}
