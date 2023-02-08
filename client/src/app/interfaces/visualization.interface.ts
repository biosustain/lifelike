import { IdType } from 'vis-network';

import {
  GraphNode,
  VisEdge,
  VisNode,
  DuplicateVisNode,
  DuplicateVisEdge,
  DefaultNodeData,
} from './neo4j.interface';

// Begin Misc. Interfaces
export interface AssociationSnippet {
  reference: Reference;
  publication: Publication;
}

export enum AssociatedType {
  LITERATURE_GENE = 'LiteratureGene',
  LITERATURE_CHEMICAL = 'LiteratureChemical',
  LITERATURE_DISEASE = 'LiteratureDisease',
}

export interface AssociatedTypeEntry {
  id: IdType;
  name: string;
  count: number;
  percentage: number;
}

export interface NodeAssociatedType {
  name: string;
  nodeId: IdType;
  snippetCount: number;
}

export interface ClusterData {
  referenceTableRows: ReferenceTableRow[];
  relationship: IdType;
  direction: Direction;
}

export enum Direction {
  TO = 'Incoming',
  FROM = 'Outgoing',
}

export interface DuplicateEdgeConnectionData {
  from: IdType;
  to: IdType;
  originalFrom: IdType;
  originalTo: IdType;
  fromLabel: string;
  toLabel: string;
  label: string;
}

export interface NodePair {
  // Note that it's inaccurate to use 'from' and 'to' terminology here, since the nodes *may* have bidirectional relationships.
  node1Id: IdType;
  node2Id: IdType;
}

export interface DuplicateNodeEdgePair {
  node: DuplicateVisNode;
  edge: DuplicateVisEdge;
}

export interface EdgeConnectionData {
  from: IdType;
  to: IdType;
  fromLabel: string;
  toLabel: string;
  label: string;
}

export interface PublicationData {
  journal: string;
  title: string;
  pmid: string;
  pubYear: number;
}

export interface Publication extends GraphNode<PublicationData> {}

export interface Reference
  extends GraphNode<{
    entry1Text: string;
    entry2Text: string;
    entry1Type: string;
    entry2Type: string;
    id: IdType;
    sentence: string;
  }> {}

export interface ReferenceTablePair {
  node: {
    id: IdType;
    displayName: string;
    label: string;
  };
  edge: {
    originalFrom: IdType;
    originalTo: IdType;
    label: string;
  };
}

export interface ReferenceTableRow {
  nodeId: IdType;
  nodeDisplayName: string;
  nodeLabel: string;
  snippetCount: number;
}

export interface SettingsFormControl {
  value: any;
  valid: boolean;
}

export interface SettingsFormValues {
  animation: SettingsFormControl;
  maxClusterShownRows: SettingsFormControl;
  [key: string]: SettingsFormControl; // Could be any number of node entity checkboxes
}

export enum SidenavEntityType {
  EMPTY,
  NODE,
  EDGE,
  CLUSTER,
  TYPE,
}

export interface SidenavClusterEntity {
  queryData: DuplicateEdgeConnectionData[];
  snippetData: SidenavSnippetData[];
  totalResults: number;
}

export interface SidenavEdgeEntity {
  queryData: EdgeConnectionData;
  snippetData: SidenavSnippetData;
  totalResults: number;
}

export interface SidenavNodeEntity<NodeData = object, EdgeData = object> {
  data: VisNode<NodeData>;
  edges: VisEdge<EdgeData>[];
}

export interface SidenavTypeEntity<Data = DefaultNodeData> {
  sourceNode: VisNode<Data>;
  connectedNodes: VisNode<Data>[];
  type: AssociatedType;
}

export interface NodeDisplayInfo {
  primaryLabel: string;
  displayName: string;
  url: string;
}

export interface SidenavSnippetData {
  to: NodeDisplayInfo;
  from: NodeDisplayInfo;
  association: string;
  snippets: AssociationSnippet[];
}

// End Misc. Interfaces

// Begin Request Interfaces

export interface ExpandNodeRequest {
  nodeId: IdType;
  filterLabels: string[];
}

export interface GroupRequest {
  relationship: string;
  node: IdType;
  direction: Direction;
}

export interface NewClusterSnippetsPageRequest {
  queryData: DuplicateEdgeConnectionData[];
  page: number;
  limit: number;
}

export interface NewEdgeSnippetsPageRequest {
  queryData: EdgeConnectionData;
  page: number;
  limit: number;
}

export interface NewNodePairSnippetsPageRequest {
  queryData: NodePair;
  page: number;
  limit: number;
}

export interface ReferenceTableDataRequest {
  nodeEdgePairs: ReferenceTablePair[];
  direction?: Direction;
  description?: string;
}

export interface BulkReferenceTableDataRequest {
  associations: ReferenceTableDataRequest[];
}

export interface AssociatedTypeSnippetCountRequest {
  source_node: IdType;
  associated_nodes: IdType[];
}

// End Request Interfaces

// Begin Response Interfaces

export interface GetEdgeSnippetsResult {
  queryData: EdgeConnectionData;
  snippetData: GetSnippetsResult;
  totalResults: number;
}

export interface GetClusterSnippetsResult {
  queryData: DuplicateEdgeConnectionData[];
  snippetData: GetSnippetsResult[];
  totalResults: number;
}

export interface GetNodePairSnippetsResult {
  queryData: NodePair;
  snippetData: GetSnippetsResult[];
  totalResults: number;
}

export interface GetReferenceTableDataResult {
  referenceTableRows: ReferenceTableRow[];
  duplicateNodeEdgePairs: DuplicateNodeEdgePair[];
  direction: Direction;
  description: string;
}

export interface GetBulkReferenceTableDataResult {
  referenceTables: GetReferenceTableDataResult[];
}

export interface GetSnippetsResult {
  snippets: AssociationSnippet[];
  fromNodeId: IdType;
  toNodeId: IdType;
  association: string;
}

export interface GetAssociatedTypeResult {
  associatedData: NodeAssociatedType[];
}

// End Response Interfaces
