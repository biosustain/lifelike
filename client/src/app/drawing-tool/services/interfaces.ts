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
  data: any;
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
  group?: string;
  size?: number;
  widthConstraint?: any;
  data?: {
    hyperlink?: string;
  };
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
 * Interface for carring data relative
 * to either node or edge
 */
interface GraphData {
  id?: string;
  label?: string;
  group?: string;
  edges?: VisNetworkGraphEdge[];
  hyperlink?: string;
  x?: number;
  y?: number;
}

/**
 * Interface for handling data between canvas and panels
 */
interface GraphSelectionData {
  edgeData?: VisNetworkGraphEdge;
  nodeData?: {
    id: string,
    group: string,
    label: string,
    edges: VisNetworkGraphEdge[],
    data: {
      hyperlink: string;
    }
  };
  otherNodes?: VisNetworkGraphNode[];
}

/**
 * Schema for annoations added in pdf-viewer
 */
interface Annotation {
  /** The entity being annotated */
  keyword: string;
  /** The type of entity */
  type: string;
  /** Color to associate with entity */
  color: string;
  /** CHEBI id or some other id system */
  id: string;
}

/**
 * Project schema definition
 */
interface Project {
  id?: string | number;
  author?: string;
  label: string;
  description: string;
  /** JSON representation of graph */
  graph: UniversalGraph;
  /** ISO-8601 timestamp of when project was last updated */
  date_modified?: string;
  /** Whether or not project is public to userbase */
  public?: boolean;
  /** URI for project */
  hash_id?: string;
}

export {
  Project,
  VisNetworkGraph,
  VisNetworkGraphEdge,
  VisNetworkGraphNode,
  UniversalGraph,
  UniversalGraphEdge,
  UniversalGraphNode,
  Annotation,
  GraphData,
  GraphSelectionData
};
