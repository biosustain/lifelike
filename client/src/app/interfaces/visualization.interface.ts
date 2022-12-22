import { IdType } from 'vis-network';

import {
    GraphNode,
    VisEdge,
    VisNode,
    DuplicateVisNode,
    DuplicateVisEdge,
    DefaultNodeData
} from './neo4j.interface';

// Begin Misc. Interfaces
export interface AssociationSnippet {
    reference: Reference;
    publication: Publication;
}

export enum AssociatedType {
  LITERATURE_GENE = 'LiteratureGene',
  LITERATURE_CHEMICAL = 'LiteratureChemical',
  LITERATURE_DISEASE = 'LiteratureDisease'
}

export interface AssociatedTypeEntry {
  id: string;
  name: string;
  count: number;
  percentage: number;
}

export interface NodeAssociatedType {
    name: string;
    nodeId: string;
    snippetCount: number;
}

export interface ClusterData {
    referenceTableRows: ReferenceTableRow[];
    relationship: string;
    direction: Direction;
}

export enum Direction {
    TO = 'Incoming',
    FROM = 'Outgoing',
}

export interface DuplicateEdgeConnectionData {
    from: string;
    to: string;
    originalFrom: string;
    originalTo: string;
    fromLabel: string;
    toLabel: string;
    label: string;
}

export interface NodePair {
  // Note that it's inaccurate to use "from" and "to" terminology here, since the nodes *may* have bidirectional relationships.
  node1Id: string;
  node2Id: string;
}

export interface DuplicateNodeEdgePair<NodeData = object, EdgeData = object> {
    node: DuplicateVisNode<NodeData>;
    edge: DuplicateVisEdge<EdgeData>;
}

export interface EdgeConnectionData {
    from: string;
    to: string;
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

export interface Publication extends GraphNode<PublicationData> {
}

export interface Reference extends GraphNode<{
        entry1Text: string;
        entry2Text: string;
        entry1Type: string;
        entry2Type: string;
        id: string;
        sentence: string;
    }> {
}

export interface ReferenceTablePair {
    node: {
        id: string;
        displayName: string;
        label: string;
    };
    edge: {
        originalFrom: string;
        originalTo: string;
        label: string;
    };
}

export interface ReferenceTableRow {
    nodeId: string;
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
    nodeId: string;
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
}

export interface AssociatedTypeSnippetCountRequest {
    source_node: string;
    associated_nodes: string[];
}

// End Request Interfaces

// Begin Response Interfaces

export interface ExpandNodeResult<NodeData = object, EdgeData = object> {
    expandedNode: string;
    nodes: VisNode<NodeData>[];
    edges: VisEdge<EdgeData>[];
}

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
    direction: Direction;
}

export interface GetSnippetsResult {
    snippets: AssociationSnippet[];
    fromNodeId: string;
    toNodeId: string;
    association: string;
}

export interface GetAssociatedTypeResult {
    associatedData: NodeAssociatedType[];
}

// End Response Interfaces
