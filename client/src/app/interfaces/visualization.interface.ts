import { IdType } from 'vis-network';

import {
    GraphNode,
    VisEdge,
    VisNode,
    DuplicateVisNode,
    DuplicateVisEdge
} from './neo4j.interface';

// Begin Misc. Interfaces
export interface AssociationSnippet {
    reference: Reference;
    publication: Publication;
    rawScore: number;
    normalizedScore: number;
}

export interface ClusterData {
    referenceTableRows: ReferenceTableRow[];
    relationship: string;
}

export enum Direction {
    TO = 'Incoming',
    FROM = 'Outgoing',
}

export interface DuplicateEdgeConnectionData {
    from: number;
    to: number;
    originalFrom: number;
    originalTo: number;
    fromLabel: string;
    toLabel: string;
    label: string;
}

export interface DuplicateNodeEdgePair {
    node: DuplicateVisNode;
    edge: DuplicateVisEdge;
}

export interface EdgeConnectionData {
    from: number;
    to: number;
    fromLabel: string;
    toLabel: string;
    label: string;
}

export interface Publication extends GraphNode {
    data: {
        journal: string;
        title: string;
        pmid: string;
        pubYear: number;
    };
}

export interface Reference extends GraphNode {
    data: {
        entry1Text: string;
        entry2Text: string;
        id: string;
        sentence: string;
    };
}

export interface ReferenceTablePair {
    node: {
        id: string;
        displayName: string;
        label: string;
    };
    edge: {
        originalFrom: number;
        originalTo: number;
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

export interface SidenavNodeEntity {
    data: VisNode;
    edges: VisEdge[];
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
    nodeId: number;
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

export interface ReferenceTableDataRequest {
    nodeEdgePairs: ReferenceTablePair[];
}

// End Request Interfaces

// Begin Response Interfaces

export interface ExpandNodeResult {
    expandedNode: number;
    nodes: VisNode[];
    edges: VisEdge[];
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

export interface GetReferenceTableDataResult {
    referenceTableRows: ReferenceTableRow[];
}

export interface GetSnippetsResult {
    snippets: AssociationSnippet[];
    fromNodeId: number;
    toNodeId: number;
    association: string;
}

// End Response Interfaces
