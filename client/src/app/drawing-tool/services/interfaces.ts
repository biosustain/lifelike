interface UniversalGraphNode {
  data: {
    x: number;
    y: number;
    hyperlink?: string;
  };
  display_name: string;
  hash: string;
  label: string;
  sub_labels: string[];
}
interface UniversalGraphEdge {
  label: string;
  data: Object;
  from: string;
  to: string;
}
interface UniversalGraph {
  nodes: UniversalGraphNode[];
  edges: UniversalGraphEdge[];
}

interface VisNetworkGraphNode {
  label?: string;
  x?: number;
  y?: number;
  id?: string;
  group?: string,
  data?: {
    hyperlink?: string;
  }
}
interface VisNetworkGraphEdge {
  id?: string;
  from?: string;
  to?: string;
  label?: string;
}
interface VisNetworkGraph {
  nodes: VisNetworkGraphNode[];
  edges: VisNetworkGraphEdge[];
}

/**
 * Schema for annoations added in pdf-viewer
 */
interface Annotation {
  /** The entity being annotated */
  keyword: String;
  /** The type of entity */
  type: String;
  /** Color to associate with entity */
  color: String;
  /** CHEBI id or some other id system */
  id: String;
}

/**
 * Project schema definition
 */
interface Project {
  id?: String|Number;
  label: String;
  description: String;
  /** JSON representation of graph */
  graph: UniversalGraph;
  /** ISO-8601 timestamp of when project was last updated */
  date_modified?: String;
}

export {
  Project,
  VisNetworkGraph,
  VisNetworkGraphEdge,
  VisNetworkGraphNode,
  UniversalGraph,
  UniversalGraphEdge,
  UniversalGraphNode,
  Annotation
}