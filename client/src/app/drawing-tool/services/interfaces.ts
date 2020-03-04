interface UniversalGraphNode {
  data: Object;
  display_name: String;
  hash: String;
  label: String;
  sub_labels: String[];
}
interface UniversalGraphEdge {
  label: String;
  data: Object;
  from: String;
  to: String;
}
interface UniversalGraph {
  nodes: UniversalGraphNode[];
  edges: UniversalGraphEdge[];
}

interface VisNetworkGraphNode {
  label: String;
  x: Number;
  y: Number;
  id: String;
  group: String
}
interface VisNetworkGraphEdge {
  id: String;
  from: String;
  to: String;
  label: String;
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