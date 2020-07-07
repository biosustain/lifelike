export interface UniversalEntityData {
  hyperlink?: string;
  detail?: string;
  source?: string;
  search?: Hyperlink[];
  subtype?: string;
}

export interface UniversalNodeStyle {
  fontSizeScale?: number;
  fillColor?: string;
  strokeColor?: string;
  lineType?: string;
  lineWidthScale?: number;
  showDetail?: boolean;
}

export interface UniversalGraphNode {
  data: {
    x: number;
    y: number;
    width?: number,
    height?: number,
  } & UniversalEntityData;
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
  style?: UniversalNodeStyle;
}

export interface UniversalEdgeStyle {
  fontSizeScale?: number;
  strokeColor?: string;
  lineType?: string;
  lineWidthScale?: number;
  sourceHeadType?: string;
  targetHeadType?: string;
}

export interface UniversalGraphEdge {
  data?: UniversalEntityData;
  label: string;
  from: string;
  to: string;
  style?: UniversalEdgeStyle;
}

export interface UniversalGraph {
  nodes: UniversalGraphNode[];
  edges: UniversalGraphEdge[];
}

export declare type UniversalGraphEntity = UniversalGraphNode | UniversalGraphEdge;

export enum GraphEntityType {
  Node = 'node',
  Edge = 'edge',
}

export interface GraphEntity {
  type: GraphEntityType;
  entity: UniversalGraphEntity;
}

export interface Hyperlink {
  url: string;
  domain: string;
}

export interface Location {
  pageNumber: number;
  rect: Rect;
}

export interface Links {
  ncbi?: string;
  uniprot?: string;
  wikipedia?: string;
  google?: string;
}

export interface Meta {
  type: string;
  color: string;
  id?: string;
  idType?: string;
  idHyperlink?: string;
  isCustom?: boolean;
  allText?: string;
  links?: Links;
  isExcluded?: boolean;
  exclusionReason?: string;
  exclusionComment?: string;
  primaryLink?: string;
}

export interface Rect {
  [index: number]: number;
}

export interface Annotation {
  pageNumber: number;
  keywords: string[];
  rects: Rect[];
  meta: Meta;
  uuid?: string;
}

/**
 * Interface for launching app wit parameters
 */
export interface LaunchApp {
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
export interface Project {
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

export interface AnnotationExclusionData {
  id: string;
  reason: string;
  comment: string;
}

export const MAP_TYPE_ID = 'LifelikeKnowledgeMap/1';
export const NODE_TYPE_ID = 'LifelikeKnowledgeNode/1';
