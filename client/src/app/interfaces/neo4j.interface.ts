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
