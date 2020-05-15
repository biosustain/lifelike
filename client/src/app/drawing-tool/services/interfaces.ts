/**
 * A graph component manages a graph and may render it.
 */
interface GraphComponent {
  /**
   * Add the given node to the graph.
   * @param node the node
   */
  addNode(node: UniversalGraphNode): void;

  /**
   * Remove the given node from the graph.
   * @param node the node
   * @return true if the node was found
   */
  removeNode(node: UniversalGraphNode): void;
}

/**
 * An action is something the user performed on a {@link GraphComponent}
 * that can be applied or rolled back.
 */
interface GraphAction {
  /**
   * A user friendly description of the action for a history log.
   */
  description: string;

  /**
   * Called to perform the action.
   * @param component the component with the graph
   */
  apply: (component: GraphComponent) => void;

  /**
   * Called to undo the action.
   * @param component the component with the graph
   */
  rollback: (component: GraphComponent) => void;
}

interface UniversalGraphNode {
  data: {
    x: number;
    y: number;
    hyperlink?: string;
    detail?: string;
    source?: string;
    search?: Hyperlink[];
  };
  display_name: string;
  hash: string;
  shape?: string;
  icon?: any;
  label: string;
  sub_labels: string[];
  color?: any;
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
declare type UniversalGraphEntity = UniversalGraphNode | UniversalGraphEdge;
enum GraphEntityType {
  Node = 'node',
  Edge = 'edge',
}
interface GraphEntity {
  type: GraphEntityType;
  entity: UniversalGraphEntity;
}

interface VisNetworkGraphNode {
  label?: string;
  x?: number;
  y?: number;
  id?: string;
  group?: string;
  size?: number;
  shape?: string;
  icon?: any;
  widthConstraint?: any;
  data?: {
    hyperlink?: string;
    detail?: string;
    source?: string;
    search?: Hyperlink[];
  };
  color?: any;
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
  data?: {
    hyperlink?: string;
    source?: string;
    detail?: string;
    search?: Hyperlink[];
  };
}

/**
 * Interface for handling data between canvas and panels
 */
interface GraphSelectionData {
  edgeData?: VisNetworkGraphEdge;
  nodeData?: {
    id: string,
    shape?: string,
    group: string,
    label: string,
    edges: VisNetworkGraphEdge[],
    data: {
      hyperlink?: string;
      detail?: string;
      source?: string;
      search?: Hyperlink[];
    }
  };
  otherNodes?: VisNetworkGraphNode[];
}

interface Hyperlink {
  url: string;
  domain: string;
}

interface Location {
  pageNumber: number;
  rect: Rect;
}

interface Links {
  ncbi?: string;
  uniprot?: string;
  wikipedia?: string;
  google?: string;
}

interface Meta {
  type: string;
  color: string;
  id?: string;
  idType?: string;
  idHyperlink?: string;
  isCustom?: boolean;
  allText?: string;
  links?: Links;
}

interface Rect {
  [index: number]: number;
}

interface Annotation {
  pageNumber: number;
  keywords: string[];
  rects: Rect[];
  meta: Meta;
}

/**
 * Interface for launching app wit parameters
 */
interface LaunchApp {
  app: string;
  arg?: {
    // For pdf-viewer, coordinate of the nnoation of pd
    coords?: number[],
    // hash of pdf to locate by
    fileId?: string,
    // page of the pdf that the annotation is located on
    pageNumber?: number
  };
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
  /** ID of the user who made the project */
  user_id?: number;
}

export {
  GraphComponent,
  GraphAction,
  Project,
  VisNetworkGraph,
  VisNetworkGraphEdge,
  VisNetworkGraphNode,
  UniversalGraph,
  UniversalGraphEdge,
  UniversalGraphNode,
  UniversalGraphEntity,
  GraphEntityType,
  GraphEntity,
  Annotation,
  Meta,
  Rect,
  Links,
  Location,
  GraphData,
  GraphSelectionData,
  LaunchApp
};
