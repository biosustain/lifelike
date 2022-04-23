import { ReferenceType } from 'app/shared/references';

export interface UniversalGraphRelationship {
  node1: GraphNode;
  node2: GraphNode;
  edge: GraphEdge;
}

export interface GraphEntityData {
  references?: Reference[];
  hyperlinks?: Hyperlink[];
  detail?: string;
  search?: Hyperlink[];
  subtype?: string;
  sources?: Source[];
}

export interface GraphNodeStyle {
  fontSizeScale?: number;
  fillColor?: string;
  strokeColor?: string;
  bgColor?: string;
  lineType?: string;
  lineWidthScale?: number;
  showDetail?: boolean;
}

export interface GraphGroup extends GraphNode {
  members: GraphNode[];
  margin: number;
}

// Created for export purpose: do not duplicate the nodes on export
export interface SimplifiedGraphGroup extends GraphNode {
  hashes: string[];
}

export interface GraphNode {
  data: {
    x: number;
    y: number;
    width?: number,
    height?: number,
  } & GraphEntityData;
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
  image_id?: string;
  label: string;
  // TODO: We do not use this anywhere, is this needed?
  sub_labels: string[];
  style?: GraphNodeStyle;
}

export type GraphNodeTemplate =
  Pick<GraphNode, 'display_name' | 'label' | 'sub_labels'>
  & { data?: Partial<GraphEntityData>, style?: Partial<GraphNodeStyle> };

export interface GraphEdgeStyle {
  fontSizeScale?: number;
  strokeColor?: string;
  lineType?: string;
  lineWidthScale?: number;
  sourceHeadType?: string;
  targetHeadType?: string;
}

export interface GraphEdge {
  data?: GraphEntityData;
  label: string;
  from: string;
  to: string;
  style?: GraphEdgeStyle;
}


export interface KnowledgeMapGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
}

export interface ExportableGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: SimplifiedGraphGroup[];
}

export declare type UniversalGraphEntity = GraphNode | GraphEdge | GraphGroup;

export enum GraphEntityType {
  Node = 'node',
  Edge = 'edge',
  Group = 'group'
}

export interface GraphEntity {
  type: GraphEntityType;
  entity: UniversalGraphEntity;
}

export interface Hyperlink {
  url: string;
  domain: string;
}

export interface Source {
  type?: ReferenceType;
  url: string;
  domain?: string;
}

export interface Reference {
  type: ReferenceType;
  id: string;
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
 * Map schema definition
 */
export interface KnowledgeMap {
  id?: string | number;
  author?: string;
  label: string;
  description: string;
  /** JSON representation of graph */
  graph: KnowledgeMapGraph;
  /** ISO-8601 timestamp of when project was last updated */
  modified_date?: string;
  /** Whether or not project is public to userbase */
  public?: boolean;
  /** URI for project */
  hash_id?: string;
  /** ID of the user who made the project */
  user_id?: number;
  /** Name of the project this map is found in */
  project_name?: string;
}

export const DETAIL_NODE_LABELS = new Set(['note', 'link', 'image']);

export function isCommonNodeDisplayName(label: string, displayName: string) {
  return displayName.toLowerCase() === label.toLowerCase();
}
