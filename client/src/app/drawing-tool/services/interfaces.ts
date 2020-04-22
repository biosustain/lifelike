interface UniversalGraphNode {
  data: {
    x: number;
    y: number;
    hyperlink?: string;
    detail?: string;
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
  data?: {
    hyperlink?: string;
    detail?: string;
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
  detail?: string;
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
      detail: string;
    }
  };
  otherNodes?: VisNetworkGraphNode[];
}

interface Location {
  pageNumber:number;
  rect: Rect;
}

interface Links {
  ncbi?: string;
  uniprot?: string;
  wikipedia?: string;
  google?: string;
}

interface Meta {
  type:string;
  color:string;
  id?:string;
  idType?: string;
  isCustom?: boolean;
  allText?: string;
  links?: Links;
}

interface Rect {
  [index:number]: number
}

interface Annotation {
  pageNumber: number;
  keywords: string[];
  rects: Rect[];
  meta: Meta;
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
  Meta,
  Rect,
  Links,
  Location,
  GraphData,
  GraphSelectionData
};
