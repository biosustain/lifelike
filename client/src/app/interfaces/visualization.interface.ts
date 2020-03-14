import { IdType } from 'vis-network';

import { VisEdge, VisNode, DuplicateVisNode, DuplicateVisEdge } from './neo4j.interface';


export interface AssociationSnippet {
    entry1Text: string;
    entry2Text: string;
    id: string;
    score: number;
    sentence: string;
}

export interface ClusteredNode {
    nodeId: number;
    edges: DuplicateVisEdge[];
}

export interface GetClusterGraphDataResult {
    results: {
        // Node ID
        [key: number]: {
            // Edge label : Snippet count
            [key: string]: number
        }
    };
}

export interface GroupRequest {
    relationship: string;
    node: IdType;
}

export interface GetLabelsResult {
    labels: Set<string>;
}

export interface GetSnippetsResult {
    references: AssociationSnippet[];
    fromNodeId: number;
    toNodeId: number;
    association: string;
}

export interface EdgeSnippetCount {
    edge: VisEdge;
    count: number;
}

export interface GetSnippetCountsFromEdgesResult {
    edgeSnippetCounts: EdgeSnippetCount[];
}

export interface NodeEdgePair {
    node: VisNode;
    edge: VisEdge;
}

export interface DuplicateNodeEdgePair {
    node: DuplicateVisNode;
    edge: DuplicateVisEdge;
}

export interface ReferenceTableRow {
    nodeDisplayName: string;
    snippetCount: number;
    edge: VisEdge;
}

export interface GetReferenceTableDataResult {
    referenceTableRows: ReferenceTableRow[];
}

export interface SidenavEntity {
    data: VisNode | VisEdge;
}

export interface SidenavNodeEntity extends SidenavEntity {
    edges: VisEdge[];
}

export interface SidenavEdgeEntity extends SidenavEntity {
    to: VisNode;
    from: VisNode;
    association: string;
    references: AssociationSnippet[];
}

export interface SidenavClusterEntity extends SidenavEntity {
    includes: VisNode[];
    clusterGraphData: GetClusterGraphDataResult;
}
