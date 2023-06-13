import { ReferenceType } from 'app/shared/references';
import { WithOptional, WithRequired } from 'app/shared/utils/types';
import { AppURL } from 'app/shared/url';

export interface UniversalGraphRelationship {
  node1: UniversalGraphNode;
  node2: UniversalGraphNode;
  edge: UniversalGraphEdge;
}

export interface UniversalEntityData {
  references?: Reference[];
  hyperlinks?: Hyperlink[];
  detail?: string;
  search?: Hyperlink[];
  subtype?: string;
  sources?: Source[];
}

export interface UniversalNodeStyle {
  fontSizeScale?: number;
  fillColor?: string;
  strokeColor?: string;
  bgColor?: string;
  lineType?: string;
  lineWidthScale?: number;
  showDetail?: boolean;
}

export interface UniversalGraphGroup extends UniversalGraphNode {
  members: UniversalGraphNode[];
  margin: number;
}

export interface UniversalGraphNode {
  data: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  } & UniversalEntityData;
  display_name: string;
  hash: string;
  shape?: string;
  icon?: {
    code: string;
    color: string;
    face: string;
    size: number;
    weight: string;
  };
  image_id?: string;
  label: string;
  // TODO: Remove.
  sub_labels: string[];
  style?: UniversalNodeStyle;
}

export type UniversalGraphNodeTemplate = Omit<UniversalGraphNode, 'data' | 'style' | 'hash'> & {
  data?: Partial<UniversalGraphNode['data']>;
  style?: Partial<UniversalGraphNode['style']>;
  hash?: Partial<UniversalGraphNode['hash']>;
};

export type UniversalGraphImageNodeTemplate = WithRequired<UniversalGraphNodeTemplate, 'image_id'>;

export type UniversalGraphGroupTemplate = UniversalGraphNodeTemplate &
  WithOptional<UniversalGraphGroup, 'margin'>;

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

export interface KnowledgeMapGraph {
  nodes: UniversalGraphNode[];
  edges: UniversalGraphEdge[];
  groups: UniversalGraphGroup[];
}

export declare type UniversalGraphEntity =
  | UniversalGraphNode
  | UniversalGraphEdge
  | UniversalGraphGroup;

export declare type UniversalGraphNodelike = UniversalGraphNode | UniversalGraphGroup;

export enum GraphEntityType {
  Node = 'node',
  Edge = 'edge',
  Group = 'group',
}

export interface GraphEntity {
  type: GraphEntityType;
  entity: UniversalGraphEntity;
}

export interface Hyperlink {
  url: string | AppURL;
  domain: string;
}

export interface Source {
  type?: ReferenceType;
  url: string | AppURL;
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
    coords?: number[];
    // hash of pdf to locate by
    fileId?: string;
    // page of the pdf that the annotation is located on
    pageNumber?: number;
  };
}

export const DETAIL_NODE_LABELS = new Set(['note', 'link', 'image']);

export function isCommonNodeDisplayName(label: string, displayName: string) {
  return displayName.toLowerCase() === label.toLowerCase();
}
