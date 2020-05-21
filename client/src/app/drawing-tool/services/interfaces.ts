interface UniversalGraphNode {
  data: {
    x: number;
    y: number;
    width?: number,
    height?: number,
    hyperlink?: string;
    detail?: string;
    source?: string;
    search?: Hyperlink[];
  };
  display_name: string;
  hash: string;
  shape?: string;
  icon?: {
    code: string,
    color: string,
    face: string,
    size: number,
    weight: string,
  };
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
  Project,
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
  LaunchApp
};
